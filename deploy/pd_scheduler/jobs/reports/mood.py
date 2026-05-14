"""Mood-log nudge via Telegram if owner did not log today.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from ...db import get_conn
from ...telegram import send_telegram_message

logger = logging.getLogger("scheduler")


def job_mood_reminder():
    """Send mood reminder if not logged today."""
    logger.info("Running: mood_reminder")
    try:
        from datetime import date

        today = date.today().isoformat()
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Filter by owner user_id to avoid matching demo user data
                cur.execute(
                    "SELECT id FROM daily_log"
                    " WHERE date = %s AND user_id = (SELECT id FROM users WHERE role = 'owner' LIMIT 1)"
                    " LIMIT 1",
                    (today,),
                )
                if cur.fetchone() is not None:
                    logger.info("Mood already logged for %s.", today)
                    return

        send_telegram_message("Ne zabuv zalohuvaty nastriy? Napyshy /mood N (-5 do +5)", parse_mode=None)
        logger.info("Mood reminder sent.")
    except Exception as e:
        logger.error("mood_reminder failed: %s", e, exc_info=True)
