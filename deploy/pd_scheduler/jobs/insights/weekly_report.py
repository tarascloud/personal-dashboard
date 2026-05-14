"""Weekly insight feedback summary via Telegram (Sunday 20:30).

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from ...db import get_conn
from ...telegram import send_telegram_message

logger = logging.getLogger("scheduler")


def job_weekly_insight_report():
    """Send weekly AI Insight feedback summary via Telegram (Sunday 20:00)."""
    logger.info("Running: weekly_insight_report")
    try:
        from datetime import date, timedelta
        from collections import defaultdict

        today = date.today()
        week_ago = (today - timedelta(days=7)).isoformat()

        with get_conn() as conn:
            with conn.cursor() as cur:
                # Count reactions per page in last 7 days
                cur.execute("""
                    SELECT page, reaction, COUNT(*)
                    FROM insight_feedback
                    WHERE created_at >= %s
                    GROUP BY page, reaction
                    ORDER BY page
                """, (week_ago,))
                rows = cur.fetchall()

                # Count prompt improvements in last 7 days
                cur.execute("""
                    SELECT COUNT(*)
                    FROM audit_log
                    WHERE action = 'prompt_improved'
                      AND created_at >= %s
                """, (week_ago,))
                prompt_improved_count = cur.fetchone()[0]

        if not rows and prompt_improved_count == 0:
            logger.info("weekly_insight_report: no feedback or prompt changes this week.")
            return

        # Build per-page summary: {page: {like: N, dislike: N}}
        page_stats = defaultdict(lambda: {"like": 0, "dislike": 0})
        for page, reaction, count in rows:
            page_stats[page][reaction] = count

        # Format message parts
        parts = []
        for page in sorted(page_stats):
            likes = page_stats[page]["like"]
            dislikes = page_stats[page]["dislike"]
            segments = []
            if likes:
                segments.append(f"{likes} 👍")
            if dislikes:
                segments.append(f"{dislikes} 👎")
            parts.append(f"{', '.join(segments)} on {page}")

        msg = "AI Insights this week: " + ". ".join(parts) + "."
        if prompt_improved_count:
            msg += f" Prompt improved {prompt_improved_count} time{'s' if prompt_improved_count != 1 else ''}."

        send_telegram_message(msg, parse_mode=None)
        logger.info("Weekly insight report sent: %s", msg)

    except Exception as e:
        logger.error("weekly_insight_report failed: %s", e, exc_info=True)
