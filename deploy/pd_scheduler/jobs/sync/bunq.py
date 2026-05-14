"""bunq sync job (auth-failure tracking, multi-account).

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from ...db import get_conn
from ...sync_state import _update_last_sync

logger = logging.getLogger("scheduler")

# bunq auth failure tracking: user_id -> True if auth failed
# (skip until next scheduler restart or manual fix)
_bunq_auth_failed: dict[int, bool] = {}


def job_sync_bunq():
    """Sync bunq transactions for all users (respects auto/manual setting).

    Handles auth errors gracefully:
    - If API key or IP is incorrect, marks user as auth-failed and skips future attempts
    - Auth failure is cleared on scheduler restart or when user re-configures credentials
    """
    logger.info("Running: sync_bunq")
    try:
        import json as _json
        from src.bunq_integration import sync_bunq
        from src.db import set_current_user
        from src.encryption import decrypt_value

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT u.id, u.email, s1.value,
                           COALESCE(s_map.value, '[]'),
                           COALESCE(s_suffix.value, 'default'),
                           COALESCE(s_auto.value, 'auto')
                    FROM users u
                    JOIN secrets s1 ON s1.user_id = u.id AND s1.key IN ('bunq_api_key', 'bunq_api_token')
                    LEFT JOIN secrets s_map ON s_map.user_id = u.id AND s_map.key = 'bunq_account_mappings'
                    LEFT JOIN secrets s_suffix ON s_suffix.user_id = u.id AND s_suffix.key = 'bunq_user_suffix'
                    LEFT JOIN secrets s_auto ON s_auto.user_id = u.id AND s_auto.key = 'bunq_auto_sync'
                    WHERE s1.value IS NOT NULL AND s1.value != ''
                """)
                users = cur.fetchall()

        for user_id, user_email, raw_api_key, mappings_json, user_suffix, auto_sync in users:
            set_current_user(user_email)
            if auto_sync == "manual":
                continue

            # Skip users with known auth failures (don't hammer bunq API)
            if _bunq_auth_failed.get(user_id):
                logger.debug("bunq user %s: skipping due to previous auth failure", user_id)
                continue

            # Decrypt API key (handles both encrypted and plaintext)
            api_key = decrypt_value(raw_api_key)

            try:
                account_list = _json.loads(mappings_json)
            except Exception:
                account_list = []

            if not account_list:
                continue

            user_auth_ok = True  # noqa: F841 — preserved from original
            for acc in account_list:
                acc_id = acc.get("account_id", 0)
                acc_name = acc.get("account_name", "bunq")
                if not acc_id:
                    continue
                try:
                    result = sync_bunq(
                        api_key=api_key,
                        account_id=acc_id,
                        days=1,
                        account_name=acc_name,
                        user_suffix=user_suffix,
                    )
                    if result["synced"] > 0:
                        logger.info("bunq user %s acc %s: synced %d, skipped %d",
                                    user_id, acc_name, result["synced"], result["skipped"])
                    _update_last_sync(user_id, user_email, "bunq", f"ok: synced={result['synced']}")
                except Exception as e:
                    err_str = str(e).lower()
                    # Detect auth/IP errors — don't retry until credentials are fixed.
                    # "insufficient authorisation" is bunq's 401 on revoked/expired sessions
                    # AND on revoked API keys — sync_bunq already retries once with a fresh
                    # session, so if we still see this here the API key itself is dead.
                    if any(phrase in err_str for phrase in [
                        "incorrect api key", "ip address", "user credentials are incorrect",
                        "unauthorized", "not allowed", "insufficient authorisation",
                    ]):
                        logger.error("bunq AUTH FAILED for user %s: %s — disabling auto-sync until fix (regenerate API key at bunq dashboard if 'insufficient authorisation' persists)", user_id, e)
                        _bunq_auth_failed[user_id] = True
                        _update_last_sync(user_id, user_email, "bunq", f"auth_error: {e}")
                        user_auth_ok = False
                        break  # No point trying other accounts for same user
                    else:
                        logger.error("bunq sync failed for user %s acc %s: %s", user_id, acc_name, e)
                        _update_last_sync(user_id, user_email, "bunq", f"error: {e}")

    except Exception as e:
        logger.error("sync_bunq failed: %s", e, exc_info=True)
