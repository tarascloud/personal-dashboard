"""Per-integration last-sync timestamp tracking.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from .db import get_conn

logger = logging.getLogger("scheduler")


def _update_last_sync(user_id: int, user_email: str, integration: str, status: str = "ok"):
    """Write last sync timestamp + status for integration."""
    from datetime import datetime
    ts = datetime.utcnow().isoformat() + "Z"
    value = f"{ts}|{status}"
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO user_preferences (user_id, key, value)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, key) DO UPDATE SET value = %s
                """, (user_id, f"{integration}_last_sync", value, value))
    except Exception as e:
        logger.warning("Failed to update last_sync for %s: %s", integration, e)
