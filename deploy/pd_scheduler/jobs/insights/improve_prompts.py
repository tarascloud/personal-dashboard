"""Weekly Gemini-driven prompt improvement based on negative feedback.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

from ...db import get_conn
from .prompts import PAGE_INSIGHT_PROMPTS

logger = logging.getLogger("scheduler")


def job_improve_insight_prompts():
    """Improve insight prompts based on negative user feedback via Gemini API (weekly, Monday 4:00)."""
    logger.info("Running: improve_insight_prompts")
    try:
        import json
        import urllib.request
        import urllib.error
        from datetime import datetime  # noqa: F401 — preserved from original

        # Get Gemini API key
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_api_key:
            try:
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT s.value FROM secrets s
                            JOIN users u ON u.id = s.user_id
                            WHERE s.key = 'gemini_api_key' AND u.role = 'owner'
                            LIMIT 1
                        """)
                        row = cur.fetchone()
                        if row and row[0]:
                            try:
                                from src.encryption import decrypt_value
                                gemini_api_key = decrypt_value(row[0])
                            except Exception:
                                gemini_api_key = row[0]
            except Exception as e:
                logger.error("Could not load Gemini API key: %s", e)

        if not gemini_api_key:
            logger.warning("improve_insight_prompts: no Gemini API key found, skipping")
            return

        # Query unprocessed negative feedback
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT f.id, f.user_id, f.page, f.comment,
                           COALESCE(i.insights_json, '') AS insight_text
                    FROM insight_feedback f
                    LEFT JOIN ai_insights i ON i.id = f.insight_id
                    WHERE f.reaction = 'dislike' AND f.processed = false
                """)
                rows = cur.fetchall()

        if not rows:
            logger.info("improve_insight_prompts: no unprocessed negative feedback")
            return

        # Group by (user_id, page)
        from collections import defaultdict
        groups = defaultdict(list)
        for fb_id, user_id, page, comment, insight_text in rows:
            groups[(user_id, page)].append({
                "id": fb_id,
                "comment": comment or "",
                "insight_text": insight_text or "",
            })

        improved_count = 0

        for (user_id, page), feedbacks in groups.items():
            if len(feedbacks) < 2:
                continue

            # Get current prompt from user_preferences
            current_prompt = PAGE_INSIGHT_PROMPTS.get(page, "")
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT value FROM user_preferences WHERE user_id = %s AND key = %s",
                        (user_id, f"insight_prompt_{page}"),
                    )
                    row = cur.fetchone()
                    if row and row[0]:
                        current_prompt = row[0]

            # Build complaints summary
            complaints = "\n".join(
                f"- Insight: \"{fb['insight_text'][:200]}\" | Complaint: \"{fb['comment'][:200]}\""
                for fb in feedbacks
            )

            # Call Gemini API
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"
            payload = json.dumps({
                "contents": [{
                    "parts": [{
                        "text": (
                            "You are an AI prompt engineer. Given the current insight generation prompt "
                            "and user complaints about the generated insights, improve the prompt to address "
                            "the user's concerns. Return ONLY the improved prompt text, nothing else.\n\n"
                            f"Current prompt:\n{current_prompt}\n\n"
                            f"User complaints ({len(feedbacks)} negative feedbacks):\n{complaints}"
                        )
                    }]
                }]
            }).encode("utf-8")

            req = urllib.request.Request(
                gemini_url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    result = json.loads(resp.read().decode("utf-8"))
                    improved_prompt = (
                        result.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                        .strip()
                    )
            except (urllib.error.URLError, urllib.error.HTTPError) as e:
                logger.error("Gemini API call failed for user %s page %s: %s", user_id, page, e)
                continue

            if not improved_prompt:
                logger.warning("Gemini returned empty prompt for user %s page %s", user_id, page)
                continue

            # Save improved prompt and mark feedback as processed
            feedback_ids = [fb["id"] for fb in feedbacks]
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Upsert improved prompt
                    cur.execute("""
                        INSERT INTO user_preferences (user_id, key, value)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (user_id, key) DO UPDATE SET value = %s
                    """, (user_id, f"insight_prompt_{page}", improved_prompt, improved_prompt))

                    # Mark feedback as processed
                    cur.execute(
                        "UPDATE insight_feedback SET processed = true WHERE id = ANY(%s)",
                        (feedback_ids,),
                    )

                    # Get user email for audit_log
                    cur.execute("SELECT email FROM users WHERE id = %s", (user_id,))
                    user_row = cur.fetchone()
                    user_email = user_row[0] if user_row else f"user_{user_id}"

                    # Log to audit_log
                    cur.execute("""
                        INSERT INTO audit_log (user_email, action, details, created_at)
                        VALUES (%s, 'prompt_improved', %s, NOW())
                    """, (user_email, json.dumps({
                        "page": page,
                        "feedback_count": len(feedbacks),
                        "old_prompt": current_prompt[:500],
                        "new_prompt": improved_prompt[:500],
                    })))

            improved_count += 1
            logger.info("Improved prompt for user %s page %s (%d feedbacks)", user_id, page, len(feedbacks))

            # --- Validate improved prompt by regenerating insight ---
            try:
                import requests as _requests
                import time as _time
                import re as _re2

                ollama_host = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/v1").rstrip("/")

                # Get user locale
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT value FROM user_preferences WHERE user_id = %s AND key = 'locale'",
                            (user_id,),
                        )
                        locale_row = cur.fetchone()
                        user_locale = locale_row[0] if locale_row else "uk"

                lang_names = {"uk": "Ukrainian", "en": "English", "es": "Spanish"}
                language = lang_names.get(user_locale, "Ukrainian")

                system_content = (
                    f"You are an AI analyst. {improved_prompt}\n"
                    f"Return ONLY a JSON array of 3-5 insights.\n"
                    f'Each insight: {{"domain":"{page}","severity":"info|warning|action","title":"short title","body":"1-2 sentences"}}'
                )
                user_content = f"Відповідай ТІЛЬКИ {language} мовою. Analyze the latest data for {page}."

                start = _time.time()
                r = _requests.post(f"{ollama_host}/api/chat", json={
                    "model": "pd-assistant",
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": user_content},
                    ],
                }, timeout=120)

                elapsed_ms = int((_time.time() - start) * 1000)
                validation_ok = False
                insights_count = 0

                if r.status_code == 200:
                    content = r.json().get("message", {}).get("content", "[]")
                    m = _re2.search(r'\[[\s\S]*\]', content)
                    if m:
                        try:
                            insights = json.loads(m.group(0))
                            insights_count = len(insights) if isinstance(insights, list) else 0
                            validation_ok = insights_count > 0
                        except json.JSONDecodeError:
                            pass

                # Log validation result
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT email FROM users WHERE id = %s", (user_id,))
                        u_row = cur.fetchone()
                        u_email = u_row[0] if u_row else f"user_{user_id}"

                        cur.execute("""
                            INSERT INTO audit_log (user_email, action, details, created_at)
                            VALUES (%s, 'prompt_validated', %s, NOW())
                        """, (u_email, json.dumps({
                            "page": page,
                            "valid": validation_ok,
                            "insights_count": insights_count,
                            "generation_ms": elapsed_ms,
                            "prompt_snippet": improved_prompt[:200],
                        })))

                if validation_ok:
                    logger.info("Prompt validation OK for user %s page %s: %d insights in %dms",
                                user_id, page, insights_count, elapsed_ms)
                else:
                    logger.warning("Prompt validation FAILED for user %s page %s (status=%s, insights=%d)",
                                   user_id, page, r.status_code if r else "N/A", insights_count)

            except Exception as ve:
                logger.warning("Prompt validation error for user %s page %s: %s", user_id, page, ve)

        logger.info("improve_insight_prompts complete: %d prompts improved", improved_count)

    except Exception as e:
        logger.error("improve_insight_prompts failed: %s", e, exc_info=True)
