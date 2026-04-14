"""
Auto-detect subscriptions from recurring transactions using Ollama AI.

Analyzes ALL transactions (not just "Subscriptions" category) for repeating
patterns, sends grouped descriptions to gemma4:e4b for intelligent
classification, and creates/updates subscriptions automatically.

Falls back to hardcoded KNOWN_SUBSCRIPTIONS dictionary if Ollama is unavailable.

Called daily by scheduler at 12:00 UTC.
"""

import json
import logging
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import requests

logger = logging.getLogger(__name__)

# Minimum occurrences to consider a transaction as subscription
MIN_OCCURRENCES = 2
# Max days between monthly payments (allow some slack)
MONTHLY_MAX_GAP_DAYS = 45
YEARLY_MAX_GAP_DAYS = 400
WEEKLY_MAX_GAP_DAYS = 10

OLLAMA_TIMEOUT = 120

# Fallback: known subscription providers when Ollama is unavailable
# description keyword -> (name, provider, category, url)
KNOWN_SUBSCRIPTIONS: dict[str, tuple[str, str, str, str | None]] = {
    "netflix": ("Netflix", "Netflix", "entertainment", "https://www.netflix.com/account"),
    "spotify": ("Spotify", "Spotify", "entertainment", "https://www.spotify.com/account"),
    "icloud": ("iCloud", "Apple", "storage", "https://appleid.apple.com"),
    "youtube": ("YouTube Premium", "Google", "entertainment", "https://www.youtube.com/paid_memberships"),
    "claude": ("Claude Pro", "Anthropic", "ai", "https://claude.ai/settings/billing"),
    "github copilot": ("GitHub Copilot", "GitHub", "development", None),
    "github": ("GitHub", "GitHub", "development", "https://github.com/settings/billing"),
    "cloudflare": ("Cloudflare", "Cloudflare", "development", "https://dash.cloudflare.com"),
    "openai": ("OpenAI", "OpenAI", "ai", "https://platform.openai.com/settings/organization/billing"),
    "chatgpt": ("ChatGPT Plus", "OpenAI", "ai", "https://chat.openai.com"),
    "gpt": ("OpenAI", "OpenAI", "ai", "https://platform.openai.com/settings/organization/billing"),
    "google one": ("Google One", "Google", "storage", "https://one.google.com"),
    "amazon prime": ("Amazon Prime", "Amazon", "entertainment", "https://www.amazon.com/mc"),
    "amazon": ("Amazon Prime", "Amazon", "entertainment", "https://www.amazon.com/mc"),
    "docker": ("Docker", "Docker", "development", "https://hub.docker.com/billing"),
    "duolingo": ("Duolingo", "Duolingo", "productivity", "https://www.duolingo.com/settings"),
    "xbox": ("Xbox Game Pass", "Microsoft", "entertainment", None),
    "microsoft 365": ("Microsoft 365", "Microsoft", "productivity", None),
    "adobe": ("Adobe CC", "Adobe", "productivity", None),
    "notion": ("Notion", "Notion", "productivity", "https://www.notion.so/my-account"),
    "linear": ("Linear", "Linear", "development", "https://linear.app/settings"),
    "figma": ("Figma", "Figma", "development", "https://www.figma.com/settings"),
    "slack": ("Slack", "Slack", "communication", None),
    "zoom": ("Zoom", "Zoom", "communication", None),
    "dropbox": ("Dropbox", "Dropbox", "storage", None),
    "hetzner": ("Hetzner", "Hetzner", "development", None),
    "digitalocean": ("DigitalOcean", "DigitalOcean", "development", None),
    "vercel": ("Vercel", "Vercel", "development", None),
    "railway": ("Railway", "Railway", "development", None),
    "forus": ("Forus", "Forus", "productivity", None),
    "homemoney": ("HomeMoney", "HomeMoney", "productivity", None),
    "home money": ("HomeMoney", "HomeMoney", "productivity", None),
    "infisical": ("Infisical", "Infisical", "development", None),
    "cursor": ("Cursor", "Cursor", "development", None),
    "copilot": ("GitHub Copilot", "GitHub", "development", None),
}

# Valid categories for subscriptions
VALID_CATEGORIES = {
    "entertainment", "productivity", "ai", "storage",
    "development", "communication", "other",
}


def _get_ollama_url() -> str:
    """Get Ollama API base URL from environment."""
    base = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
    # Strip /v1 suffix if present (OpenAI-compat format)
    base = base.rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    return base


def _normalize_description(desc: str) -> str:
    """Normalize transaction description for grouping."""
    d = desc.strip().lower()
    for prefix in ["оплата ", "списання ", "payment ", "recurring "]:
        if d.startswith(prefix):
            d = d[len(prefix):]
    # Collapse whitespace
    d = re.sub(r"\s+", " ", d).strip()
    return d


def _detect_billing_cycle(dates: list[datetime]) -> str:
    """Detect billing cycle from sorted transaction dates."""
    if len(dates) < 2:
        return "monthly"

    gaps: list[int] = []
    for i in range(1, len(dates)):
        gap = (dates[i] - dates[i - 1]).days
        if gap > 0:
            gaps.append(gap)

    if not gaps:
        return "monthly"

    avg_gap = sum(gaps) / len(gaps)

    if avg_gap <= WEEKLY_MAX_GAP_DAYS:
        return "weekly"
    elif avg_gap <= MONTHLY_MAX_GAP_DAYS:
        return "monthly"
    else:
        return "yearly"


def _next_billing_date(dates: list[datetime], cycle: str) -> datetime:
    """Estimate next billing date from last transaction date."""
    last = max(dates)
    if cycle == "weekly":
        return last + timedelta(days=7)
    elif cycle == "yearly":
        return last + timedelta(days=365)
    else:
        month = last.month + 1
        year = last.year
        if month > 12:
            month = 1
            year += 1
        day = min(last.day, 28)
        return datetime(year, month, day)


def _match_known_subscription(desc: str) -> tuple[str, str, str, str | None] | None:
    """Try to match description to a known subscription (fallback)."""
    dl = desc.lower()
    # Try longer keywords first to match "github copilot" before "github"
    for keyword in sorted(KNOWN_SUBSCRIPTIONS.keys(), key=len, reverse=True):
        if keyword in dl:
            return KNOWN_SUBSCRIPTIONS[keyword]
    return None


def _build_ollama_prompt(
    groups: dict[str, list[dict[str, Any]]],
) -> str:
    """Build the prompt for Ollama to classify transaction groups."""
    lines: list[str] = []
    for key, txns in sorted(groups.items()):
        count = len(txns)
        avg_amount = sum(t["amount_eur"] for t in txns) / count
        currencies = {t["currency"] for t in txns}
        currency_str = "/".join(sorted(currencies))
        # Collect unique original descriptions for context
        unique_descs = sorted({t["desc"] for t in txns})
        desc_str = ", ".join(f'"{d}"' for d in unique_descs[:5])
        lines.append(
            f'- {desc_str} ({count} times, avg {avg_amount:.2f} {currency_str})'
        )

    txn_list = "\n".join(lines)

    return f"""Identify DIGITAL subscriptions and services from these transactions.

INCLUDE: software subscriptions, streaming services, cloud storage, AI tools, SaaS, hosting, domain renewals, app subscriptions, digital services, insurance policies, gym/fitness memberships.

EXCLUDE (NOT subscriptions): supermarkets (Mercadona, Lidl, Aldi), retail stores (Decathlon, IKEA, Amazon purchases), restaurants, gas stations, personal transfers, baby products (pampers/diapers), flowers, hairdresser/barber, one-time purchases, groceries, physical goods.

For each subscription, return JSON with:
- name: canonical service name (e.g. "YouTube Premium")
- provider: company name
- category: one of: entertainment, productivity, ai, storage, development, communication, other
- billingCycle: monthly, yearly, or weekly
- descriptions: array of matching transaction description strings

Group similar descriptions (e.g. "openAI", "open AI", "gpt" → OpenAI).
Return ONLY a valid JSON array, no other text.

Transactions:
{txn_list}

Example response:
[{{"name": "Netflix", "provider": "Netflix", "category": "entertainment", "billingCycle": "monthly", "descriptions": ["netflix", "Netflix"]}}]"""


def _call_ollama(prompt: str) -> list[dict[str, Any]] | None:
    """Call Ollama API and parse JSON response. Returns None on failure."""
    ollama_url = _get_ollama_url()

    try:
        resp = requests.post(
            f"{ollama_url}/api/chat",
            json={
                "model": "pd-assistant",
                "stream": False,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a financial analyst. You analyze transaction "
                            "descriptions and identify recurring subscriptions. "
                            "Always respond with valid JSON only, no markdown."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "options": {
                    "temperature": 0.1,
                    "num_predict": 4096,
                },
            },
            timeout=OLLAMA_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.ConnectionError:
        logger.warning("Ollama not reachable at %s, using fallback", ollama_url)
        return None
    except requests.Timeout:
        logger.warning("Ollama request timed out after %ds", OLLAMA_TIMEOUT)
        return None
    except requests.RequestException as e:
        logger.warning("Ollama request failed: %s", e)
        return None

    try:
        data = resp.json()
        content = data.get("message", {}).get("content", "")
        if not content.strip():
            logger.warning("Ollama returned empty content")
            return None

        # Extract JSON from response — model might wrap in ```json ... ```
        text = content.strip()
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if json_match:
            text = json_match.group(1).strip()

        result = json.loads(text)
        if not isinstance(result, list):
            logger.warning("Ollama returned non-array JSON: %s", type(result))
            return None

        return result
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("Failed to parse Ollama response: %s", e)
        return None


def _classify_with_ollama(
    groups: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]] | None:
    """Use Ollama to classify transaction groups into subscriptions.

    Splits into batches of 15 groups to avoid timeout on slower models.
    """
    if not groups:
        return []

    # Split into batches of 15 groups
    BATCH_SIZE = 15
    group_items = list(groups.items())
    all_ai_results: list[dict[str, Any]] = []

    for i in range(0, len(group_items), BATCH_SIZE):
        batch = dict(group_items[i:i + BATCH_SIZE])
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(group_items) + BATCH_SIZE - 1) // BATCH_SIZE
        logger.info("Ollama batch %d/%d (%d groups)", batch_num, total_batches, len(batch))

        prompt = _build_ollama_prompt(batch)
        ai_result = _call_ollama(prompt)

        if ai_result is None:
            logger.warning("Ollama failed on batch %d, aborting AI classification", batch_num)
            return None

        all_ai_results.extend(ai_result)

    ai_result = all_ai_results

    # Validate and normalize AI response
    candidates: list[dict[str, Any]] = []
    for item in ai_result:
        if not isinstance(item, dict):
            continue

        name = item.get("name", "").strip()
        provider = item.get("provider", "").strip()
        category = item.get("category", "other").strip().lower()
        billing_cycle = item.get("billingCycle", "monthly").strip().lower()
        descriptions = item.get("descriptions", [])

        if not name or not provider:
            continue

        if category not in VALID_CATEGORIES:
            category = "other"

        if billing_cycle not in ("monthly", "yearly", "weekly"):
            billing_cycle = "monthly"

        if not isinstance(descriptions, list):
            descriptions = [str(descriptions)]

        # Find matching transaction groups by description
        matched_txns: list[dict[str, Any]] = []
        for desc in descriptions:
            desc_lower = str(desc).strip().lower()
            # Normalize the description the same way
            desc_normalized = _normalize_description(desc_lower)
            if desc_normalized in groups:
                matched_txns.extend(groups[desc_normalized])
            else:
                # Try partial match
                for key, txns in groups.items():
                    if desc_lower in key or key in desc_lower:
                        matched_txns.extend(txns)

        if not matched_txns:
            # Try matching by name against all groups
            name_lower = name.lower()
            for key, txns in groups.items():
                if name_lower in key or key in name_lower:
                    matched_txns.extend(txns)

        if not matched_txns:
            logger.debug("AI suggested '%s' but no matching transactions found", name)
            continue

        # Deduplicate transactions (same date + amount)
        seen: set[tuple[str, float]] = set()
        unique_txns: list[dict[str, Any]] = []
        for t in matched_txns:
            key = (str(t["date"]), t["amount_eur"])
            if key not in seen:
                seen.add(key)
                unique_txns.append(t)
        matched_txns = unique_txns

        if len(matched_txns) < MIN_OCCURRENCES:
            logger.debug(
                "AI suggested '%s' but only %d transactions found (need %d)",
                name, len(matched_txns), MIN_OCCURRENCES,
            )
            continue

        dates = sorted([t["date"] for t in matched_txns])
        date_span = (max(dates) - min(dates)).days
        if date_span < 7:
            continue

        # Use AI-detected billing cycle or recalculate from dates
        detected_cycle = _detect_billing_cycle(dates)
        # Prefer AI cycle if it makes sense, otherwise use detected
        if billing_cycle != detected_cycle:
            logger.debug(
                "AI said '%s' is %s but dates suggest %s, using dates",
                name, billing_cycle, detected_cycle,
            )
            billing_cycle = detected_cycle

        latest = matched_txns[-1]
        amounts_eur = [t["amount_eur"] for t in matched_txns]
        avg_amount_eur = sum(amounts_eur) / len(amounts_eur)

        candidates.append({
            "name": name,
            "provider": provider,
            "amount": round(latest["amount_orig"], 2),
            "currency": latest["currency"],
            "billing_cycle": billing_cycle,
            "next_billing": _next_billing_date(dates, billing_cycle),
            "category": category,
            "url": None,
            "occurrences": len(matched_txns),
            "avg_amount_eur": round(avg_amount_eur, 2),
        })

    return candidates


def _classify_with_fallback(
    groups: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Classify using hardcoded KNOWN_SUBSCRIPTIONS dictionary (fallback)."""
    candidates: list[dict[str, Any]] = []

    for key, txns in groups.items():
        if len(txns) < MIN_OCCURRENCES:
            continue

        amounts = [t["amount_eur"] for t in txns]
        avg_amount = sum(amounts) / len(amounts)
        if avg_amount < 0.50:
            continue

        dates = sorted([t["date"] for t in txns])
        cycle = _detect_billing_cycle(dates)

        date_span = (max(dates) - min(dates)).days
        if date_span < 7:
            continue

        latest = txns[-1]
        known = _match_known_subscription(key)

        if known:
            name, provider, category, url = known
        else:
            name = txns[0]["desc"].strip()
            name = " ".join(w.capitalize() for w in name.split()[:4])
            provider = name
            category = "other"
            url = None

        candidates.append({
            "name": name,
            "provider": provider,
            "amount": round(latest["amount_orig"], 2),
            "currency": latest["currency"],
            "billing_cycle": cycle,
            "next_billing": _next_billing_date(dates, cycle),
            "category": category,
            "url": url,
            "occurrences": len(txns),
            "avg_amount_eur": round(avg_amount, 2),
        })

    return candidates


def detect_subscriptions(conn: Any, user_id: int) -> dict[str, int]:
    """
    Analyze transactions and create/update subscriptions.

    Uses Ollama gemma4:e4b to intelligently classify transaction descriptions
    into subscriptions. Falls back to hardcoded dictionary if Ollama is unavailable.

    Returns: {"created": N, "updated": N, "skipped": N}
    """
    cur = conn.cursor()

    # 1. Get subscription-category transactions + all recurring (≥3 occurrences)
    cur.execute("""
        WITH sub_cat AS (
            SELECT description, amount_eur, amount_original, currency_original, date
            FROM transactions
            WHERE user_id = %s
              AND description IS NOT NULL AND description != ''
              AND amount_eur IS NOT NULL
              AND date >= NOW() - INTERVAL '2 years'
              AND category IN ('Підписки', 'Підписки / Стрімінг')
        ),
        recurring AS (
            SELECT t.description, t.amount_eur, t.amount_original, t.currency_original, t.date
            FROM transactions t
            JOIN (
                SELECT lower(description) as d FROM transactions
                WHERE user_id = %s AND description IS NOT NULL AND description != ''
                  AND amount_eur IS NOT NULL AND date >= NOW() - INTERVAL '2 years'
                GROUP BY lower(description) HAVING count(*) >= 3
            ) freq ON lower(t.description) = freq.d
            WHERE t.user_id = %s AND t.date >= NOW() - INTERVAL '2 years'
              AND t.amount_eur IS NOT NULL
        )
        SELECT * FROM sub_cat
        UNION
        SELECT * FROM recurring
        ORDER BY description, date
    """, (user_id, user_id, user_id))
    all_txns = cur.fetchall()

    if not all_txns:
        logger.info("No transactions found for user %d", user_id)
        return {"created": 0, "updated": 0, "skipped": 0}

    # 2. Group by normalized description
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for desc, amount_eur, amount_orig, currency, txn_date in all_txns:
        key = _normalize_description(desc)
        if key:
            groups[key].append({
                "desc": desc,
                "amount_eur": abs(float(amount_eur)),
                "amount_orig": abs(float(amount_orig)) if amount_orig else abs(float(amount_eur)),
                "currency": currency or "EUR",
                "date": txn_date,
            })

    # Filter groups with enough occurrences before sending to AI
    # (no point analyzing one-off transactions)
    recurring_groups: dict[str, list[dict[str, Any]]] = {
        k: v for k, v in groups.items()
        if len(v) >= MIN_OCCURRENCES and sum(t["amount_eur"] for t in v) / len(v) >= 0.50
    }

    logger.info(
        "Found %d transaction groups (%d with %d+ occurrences) for user %d",
        len(groups), len(recurring_groups), MIN_OCCURRENCES, user_id,
    )

    # 3. Try Ollama classification, fall back to dictionary
    candidates = _classify_with_ollama(recurring_groups)
    if candidates is None:
        logger.info("Ollama unavailable, using fallback dictionary")
        candidates = _classify_with_fallback(recurring_groups)
    else:
        logger.info("Ollama classified %d subscriptions", len(candidates))

    # 4. Get existing subscriptions (case-insensitive lookup)
    cur.execute("""
        SELECT id, name, provider, amount, currency, billing_cycle
        FROM subscriptions
        WHERE user_id = %s
    """, (user_id,))
    existing: dict[str, tuple[Any, ...]] = {
        row[1].lower(): row for row in cur.fetchall()
    }

    # 5. Create or update
    created = 0
    updated = 0
    skipped = 0

    for c in candidates:
        name_lower = c["name"].lower()

        if name_lower in existing:
            # Update next_billing if we have a newer estimate
            sub_id = existing[name_lower][0]
            cur.execute("""
                UPDATE subscriptions
                SET next_billing = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s
                  AND (next_billing IS NULL OR next_billing < %s)
            """, (c["next_billing"], sub_id, user_id, c["next_billing"]))
            if cur.rowcount > 0:
                updated += 1
                logger.info(
                    "Updated subscription '%s': next_billing=%s",
                    c["name"], c["next_billing"].strftime("%Y-%m-%d"),
                )
            else:
                skipped += 1
        else:
            # Create new subscription
            cur.execute("""
                INSERT INTO subscriptions (
                    user_id, name, provider, amount, currency, billing_cycle,
                    next_billing, category, is_active, url, notes,
                    created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true, %s, %s, NOW(), NOW())
            """, (
                user_id, c["name"], c["provider"], c["amount"], c["currency"],
                c["billing_cycle"], c["next_billing"], c["category"], c["url"],
                f"Auto-detected by AI from {c['occurrences']} transactions",
            ))
            created += 1
            logger.info(
                "Created subscription '%s': %s %s/%s (%d transactions)",
                c["name"], c["amount"], c["currency"],
                c["billing_cycle"], c["occurrences"],
            )

    conn.commit()
    return {"created": created, "updated": updated, "skipped": skipped}
