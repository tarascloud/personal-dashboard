"""Withings sync job.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from ...db import get_conn
from ...sync_state import _update_last_sync

logger = logging.getLogger("scheduler")


def job_sync_withings():
    """Sync Withings data for all users."""
    logger.info("Running: sync_withings")
    try:
        import json
        from src.sync.withings_sync import refresh_withings_token, sync_withings_measurements

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT u.id, u.email, s.value
                    FROM users u
                    JOIN secrets s ON s.user_id = u.id AND s.key = 'withings_tokens'
                    WHERE s.value IS NOT NULL AND s.value != ''
                """)
                users = cur.fetchall()

        for user_id, user_email, raw_tokens_json in users:
            try:
                from src.encryption import decrypt_value
                tokens_json = decrypt_value(raw_tokens_json)
                tokens = json.loads(tokens_json)
                access_token = tokens["access_token"]
                client_id = tokens.get("client_id")
                client_secret = tokens.get("consumer_secret")

                def _do_refresh():
                    updated = refresh_withings_token(tokens, client_id, client_secret)
                    with get_conn() as c:
                        with c.cursor() as cur:
                            cur.execute(
                                "INSERT INTO secrets (user_id, key, value) "
                                "VALUES (%s, 'withings_tokens', %s) "
                                "ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value",
                                (user_id, json.dumps(updated)),
                            )
                    return updated["access_token"]

                with get_conn() as conn:
                    result = sync_withings_measurements(access_token, conn, refresh_func=_do_refresh)
                    count = result.get("measurements", 0)
                    if count > 0:
                        logger.info("Withings user %s: %d measurements", user_id, count)
                    _update_last_sync(user_id, user_email, "withings", f"ok: {count} measurements")
            except Exception as e:
                logger.error("Withings sync failed for user %s: %s", user_id, e)
                _update_last_sync(user_id, user_email, "withings", f"error: {e}")

    except Exception as e:
        logger.error("sync_withings failed: %s", e, exc_info=True)
