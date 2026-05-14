"""Report content builders: daily/weekly summaries + Ollama AI insights helper.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from .db import get_conn

logger = logging.getLogger("scheduler")


def _generate_ollama_insights() -> str | None:
    """Generate AI insights via Ollama pd-assistant for Telegram."""
    import requests
    try:
        # Get data context from DB
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT content FROM ai_context_snapshots
                    WHERE period_type = 'chat-context'
                    ORDER BY generated_at DESC LIMIT 1
                """)
                row = cur.fetchone()
                if not row:
                    return None
                context = row[0]

        resp = requests.post(
            "http://ollama:11434/api/chat",
            json={
                "model": "pd-assistant",
                "stream": False,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are an AI analyst. Analyze the user data and provide 3-5 brief insights. "
                            "Format each as: emoji + one sentence with specific numbers. "
                            "Use Ukrainian language. No headers, just the list."
                        ),
                    },
                    {"role": "user", "content": f"Дай інсайти:\n{context[:3000]}"},
                ],
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data.get("message", {}).get("content", "")
        return content.strip() if content.strip() else None
    except Exception as e:
        logger.warning("Ollama insights failed: %s", e)
        return None


def _build_daily_report() -> str | None:
    """Build daily summary text for Telegram."""
    from datetime import date, timedelta

    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()  # noqa: F841 — kept for parity

    lines = [f"📊 *Daily Report — {today}*\n"]

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Today's transactions
                cur.execute(
                    "SELECT type, COUNT(*), COALESCE(SUM(amount_eur), 0) "
                    "FROM transactions WHERE date = %s GROUP BY type",
                    (today,),
                )
                tx_rows = cur.fetchall()
                if tx_rows:
                    for tx_type, cnt, total in tx_rows:
                        emoji = "💰" if tx_type == "INCOME" else "💸"
                        lines.append(f"{emoji} {tx_type}: {cnt} txns, €{total:.0f}")
                else:
                    lines.append("No transactions today.")

                # Mood/daily log — filter by owner user_id to avoid reading demo data
                cur.execute(
                    "SELECT mood_delta, level FROM daily_log"
                    " WHERE date = %s AND user_id = (SELECT id FROM users WHERE role = 'owner' LIMIT 1)"
                    " LIMIT 1",
                    (today,),
                )
                mood_row = cur.fetchone()
                if mood_row:
                    mood, level = mood_row
                    lines.append(f"\n😊 Mood: {mood or '—'}, Level: {level or '—'}")

    except Exception as e:
        logger.warning("daily_report query failed: %s", e)
        return None

    # Add AI insights
    insights = _generate_ollama_insights()
    if insights:
        lines.append(f"\n✨ *AI Insights:*\n{insights}")

    return "\n".join(lines) if len(lines) > 1 else None


def _build_weekly_report() -> str | None:
    """Build weekly summary text for Telegram."""
    from datetime import date, timedelta

    today = date.today()
    week_ago = (today - timedelta(days=7)).isoformat()
    today_str = today.isoformat()

    lines = [f"📊 *Weekly Report — {week_ago} to {today_str}*\n"]

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Week's expenses by category
                cur.execute(
                    "SELECT category, COUNT(*), COALESCE(SUM(amount_eur), 0) "
                    "FROM transactions "
                    "WHERE date >= %s AND date <= %s AND type = 'EXPENSE' "
                    "GROUP BY category ORDER BY 3 DESC LIMIT 10",
                    (week_ago, today_str),
                )
                cat_rows = cur.fetchall()
                if cat_rows:
                    total_expense = sum(r[2] for r in cat_rows)
                    lines.append(f"💸 Total expenses: €{total_expense:.0f}\n")
                    for cat, cnt, amt in cat_rows:
                        lines.append(f"  • {cat}: €{amt:.0f} ({cnt} txns)")
                else:
                    lines.append("No expenses this week.")

                # Week's income
                cur.execute(
                    "SELECT COALESCE(SUM(amount_eur), 0) FROM transactions "
                    "WHERE date >= %s AND date <= %s AND type = 'INCOME'",
                    (week_ago, today_str),
                )
                income = cur.fetchone()[0]
                if income:
                    lines.append(f"\n💰 Income: €{income:.0f}")

    except Exception as e:
        logger.warning("weekly_report query failed: %s", e)
        return None

    return "\n".join(lines) if len(lines) > 1 else None
