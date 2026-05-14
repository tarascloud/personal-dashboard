"""Monobank sync job (multi-account, respects auto/manual setting).

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from ...db import get_conn

logger = logging.getLogger("scheduler")


def job_sync_monobank():
    """Sync Monobank transactions for all users (respects auto/manual setting)."""
    logger.info("Running: sync_monobank")
    try:
        import json as _json
        from src.monobank import sync_monobank
        from src.db import set_current_user
        from src.encryption import decrypt_value

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT u.id, u.email, s1.value,
                           COALESCE(s_map.value, ''),
                           COALESCE(s2.value, ''),
                           COALESCE(s3.value, 'Mono'),
                           COALESCE(s_auto.value, 'auto')
                    FROM users u
                    JOIN secrets s1 ON s1.user_id = u.id AND s1.key = 'monobank_token'
                    LEFT JOIN secrets s_map ON s_map.user_id = u.id AND s_map.key = 'monobank_account_mappings'
                    LEFT JOIN secrets s2 ON s2.user_id = u.id AND s2.key = 'monobank_account_id'
                    LEFT JOIN secrets s3 ON s3.user_id = u.id AND s3.key = 'monobank_account_name'
                    LEFT JOIN secrets s_auto ON s_auto.user_id = u.id AND s_auto.key = 'monobank_auto_sync'
                    WHERE s1.value IS NOT NULL AND s1.value != ''
                """)
                users = cur.fetchall()

        for user_id, user_email, raw_token, mappings_json, old_acc_id, old_acc_name, auto_sync in users:
            set_current_user(user_email)
            # Skip users with manual sync mode
            if auto_sync == "manual":
                continue

            # Decrypt token (handles both encrypted and plaintext)
            token = decrypt_value(raw_token)

            # Parse account mappings (new multi-account format)
            account_list = []
            if mappings_json:
                try:
                    account_list = _json.loads(mappings_json)
                except Exception:
                    pass
            # Fallback to old single-account config
            if not account_list and old_acc_id:
                account_list = [{"account_id": old_acc_id, "account_name": old_acc_name}]

            if not account_list:
                continue

            for acc in account_list:
                acc_id = acc.get("account_id", "")
                acc_name = acc.get("account_name", "Mono")
                if not acc_id:
                    continue
                try:
                    result = sync_monobank(
                        token=token,
                        account_id=acc_id,
                        days=3,
                        account_name=acc_name,
                    )
                    if result["synced"] > 0:
                        logger.info("Monobank user %s acc %s: synced %d, skipped %d",
                                    user_id, acc_name, result["synced"], result["skipped"])
                except Exception as e:
                    logger.error("Monobank sync failed for user %s acc %s: %s", user_id, acc_name, e)

    except Exception as e:
        logger.error("sync_monobank failed: %s", e, exc_info=True)
