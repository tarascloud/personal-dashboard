"""Nightly AI insights generation per page via Ollama (00:15 UTC).

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).

CRITICAL: ON CONFLICT clause uses (user_id, page, period, variant) — DO NOT change.
This was specifically fixed in DEV-20260507-0009 (Wave 1) to match the
20260324_ab_test_insights migration's UNIQUE index.
"""

import logging
import os

from ...db import get_conn
from .prompts import PAGE_INSIGHT_PROMPTS

logger = logging.getLogger("scheduler")

__all__ = ["PAGE_INSIGHT_PROMPTS", "job_generate_ai_insights"]


def job_generate_ai_insights():
    """Generate AI insights per page using Ollama (nightly, 00:15 UTC)."""
    logger.info("Running: generate_ai_insights")
    import json
    import time
    import requests
    from datetime import date
    from src.database import set_current_user

    ollama_host = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/v1").rstrip("/")

    # Check Ollama availability
    try:
        r = requests.get(f"{ollama_host}/api/tags", timeout=5)
        if r.status_code != 200:
            logger.error("Ollama not available: %s", r.status_code)
            return
    except Exception as e:
        logger.error("Ollama connection failed: %s", e)
        return

    # Process each user
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, email FROM users WHERE role IN ('owner', 'user')")
            users = cur.fetchall()
            cur.close()
    except Exception as e:
        logger.error("Failed to fetch users: %s", e)
        return

    today = date.today().isoformat()
    import re as _re

    for user_id, email in users:
        set_current_user(email)
        logger.info("Generating insights for user %s (%s)", user_id, email)

        # Build context
        try:
            from src.analytics import build_full_context
            context = build_full_context()
        except Exception as e:
            logger.warning("Context build failed for user %s: %s", user_id, e)
            context = "No data available"

        # Refresh pd-assistant model with fresh context
        try:
            modelfile = f'''FROM llama3.2:3b

PARAMETER temperature 0.4
PARAMETER num_ctx 4096

SYSTEM """You are a personal AI analyst. Analyze data and produce JSON array of insights.
Each insight: {{"domain":"...", "severity":"info|warning|action", "title":"...", "body":"...", "comparison":"vs previous: +/-X%"}}
Return ONLY the JSON array.

{context[:3000]}"""'''

            requests.post(f"{ollama_host}/api/create", json={
                "model": "pd-assistant", "modelfile": modelfile
            }, timeout=60)
            logger.info("pd-assistant model refreshed")
        except Exception as e:
            logger.warning("Model refresh failed: %s", e)

        # Check for user-customized prompts and locale
        user_locale = "uk"
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT key, value FROM user_preferences WHERE user_id=%s AND key LIKE 'insight_prompt_%%' OR (user_id=%s AND key = 'locale')",
                (user_id, user_id)
            )
            custom_prompts = {}
            for row in cur.fetchall():
                if row[0] == "locale":
                    user_locale = row[1]
                else:
                    custom_prompts[row[0].replace("insight_prompt_", "")] = row[1]
            cur.close()

        lang_names = {"uk": "Ukrainian", "en": "English", "es": "Spanish"}
        language = lang_names.get(user_locale, "Ukrainian")

        # Generate insights per page
        for page, default_prompt in PAGE_INSIGHT_PROMPTS.items():
            prompt = custom_prompts.get(page, default_prompt)
            logger.info("  → %s", page)
            start = time.time()

            try:
                r = requests.post(f"{ollama_host}/api/chat", json={
                    "model": "pd-assistant",
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": f"You are an AI analyst. {prompt}\nReturn ONLY a JSON array of 3-5 insights.\nEach insight: {{\"domain\":\"{page}\",\"severity\":\"info|warning|action\",\"title\":\"short title\",\"body\":\"1-2 sentences\"}}"},
                        {"role": "user", "content": f"Відповідай ТІЛЬКИ {language} мовою. Analyze:\n{context[:2500]}"},
                    ],
                }, timeout=180)

                elapsed_ms = int((time.time() - start) * 1000)

                if r.status_code != 200:
                    logger.warning("  Ollama returned %s for %s", r.status_code, page)
                    continue

                content = r.json().get("message", {}).get("content", "[]")
                m = _re.search(r'\[[\s\S]*\]', content)
                insights = json.loads(m.group(0)) if m else []

                # NOTE: ai_insights UNIQUE index is (user_id, page, period, variant)
                # since migration 20260324_ab_test_insights. The scheduler runs daily
                # so we use period=today (daily granularity) and variant='default'.
                # Next.js writers (saveInsightVariant) follow the same convention.
                # CRITICAL (DEV-20260507-0009 fix): the ON CONFLICT target tuple MUST
                # remain (user_id, page, period, variant). Do NOT change.
                with get_conn() as conn:
                    cur = conn.cursor()
                    cur.execute("""
                        INSERT INTO ai_insights (user_id, page, date, period, variant, insights_json, prompt_used, model, generation_ms)
                        VALUES (%s, %s, %s, %s, 'default', %s, %s, 'pd-assistant', %s)
                        ON CONFLICT (user_id, page, period, variant) DO UPDATE SET
                            date = EXCLUDED.date,
                            insights_json = EXCLUDED.insights_json,
                            prompt_used = EXCLUDED.prompt_used,
                            generation_ms = EXCLUDED.generation_ms,
                            created_at = NOW()
                    """, (user_id, page, today, today, json.dumps(insights), prompt, elapsed_ms))
                    cur.close()

                logger.info("  ✓ %s: %d insights in %dms", page, len(insights), elapsed_ms)

            except Exception as e:
                logger.warning("  ✗ %s failed: %s", page, e)
                continue

    logger.info("AI insights generation complete")
