"""Garmin sync job (with MFA + 429 backoff).

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

from ...db import get_conn
from ...sync_state import _update_last_sync

logger = logging.getLogger("scheduler")

# Store pending MFA state per user (in-memory, survives across scheduler ticks)
_garmin_mfa_pending: dict[int, tuple] = {}  # user_id -> (client, client_state)

# Garmin 429 backoff tracking: user_id -> timestamp of last 429 error
_garmin_429_backoff: dict[int, float] = {}
_GARMIN_BACKOFF_SECONDS = 24 * 60 * 60  # 24 hours backoff after 429


def job_sync_garmin():
    """Sync Garmin data for all users. Supports MFA via DB-based code exchange.

    Includes exponential backoff on 429 Too Many Requests:
    - Tracks last 429 time per user in memory
    - Skips sync if within 6-hour backoff window
    - Prefers garth session resume over fresh login to reduce API calls
    """
    import time as _time
    logger.info("Running: sync_garmin")
    try:
        from src.sync.garmin_sync import authenticate_garmin, GarminMFARequired, sync_garmin_data
        from src.database import set_current_user, get_conn as app_get_conn
        from src.encryption import decrypt_value
        from pathlib import Path

        garth_base = Path(os.environ.get("GARTH_SESSION_DIR", "/data/garth_sessions"))

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT u.id, u.email, s1.value, s2.value
                    FROM users u
                    JOIN secrets s1 ON s1.user_id = u.id AND s1.key = 'garmin_email'
                    JOIN secrets s2 ON s2.user_id = u.id AND s2.key = 'garmin_password'
                    WHERE s1.value IS NOT NULL AND s1.value != ''
                      AND s2.value IS NOT NULL AND s2.value != ''
                """)
                users = cur.fetchall()

        for user_id, user_email, raw_garmin_email, raw_garmin_password in users:
            garmin_email = decrypt_value(raw_garmin_email)
            garmin_password = decrypt_value(raw_garmin_password)
            # Check 429 backoff — skip if within backoff window
            last_429 = _garmin_429_backoff.get(user_id, 0)
            if last_429 and (_time.time() - last_429) < _GARMIN_BACKOFF_SECONDS:
                remaining = int((_GARMIN_BACKOFF_SECONDS - (_time.time() - last_429)) / 60)
                logger.info("Garmin user %s: skipping due to 429 backoff (%d min remaining)", user_id, remaining)
                continue

            garth_dir = str(garth_base / str(user_id))
            os.makedirs(garth_dir, exist_ok=True)

            # Check if there's a pending MFA code from the user
            mfa_code = None
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT value FROM user_preferences WHERE user_id = %s AND key = 'garmin_mfa_code'",
                        (user_id,),
                    )
                    row = cur.fetchone()
                    if row and row[0] and row[0].strip():
                        mfa_code = row[0].strip()

            client = None

            # If we have a pending MFA state AND user provided a code, resume login
            if user_id in _garmin_mfa_pending and mfa_code:
                pending_client, pending_state = _garmin_mfa_pending[user_id]
                try:
                    pending_client.resume_login(pending_state, mfa_code)
                    pending_client.garth.dump(garth_dir)
                    client = pending_client
                    del _garmin_mfa_pending[user_id]
                    logger.info("Garmin MFA login completed for user %s.", user_id)
                    # Clear the used MFA code
                    with get_conn() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE user_preferences SET value = '' WHERE user_id = %s AND key = 'garmin_mfa_code'",
                                (user_id,),
                            )
                except Exception as e:
                    logger.error("Garmin MFA resume failed for user %s: %s", user_id, e)
                    del _garmin_mfa_pending[user_id]
                    # Clear invalid MFA code
                    with get_conn() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE user_preferences SET value = '' WHERE user_id = %s AND key = 'garmin_mfa_code'",
                                (user_id,),
                            )
                    continue

            # Normal auth (with optional MFA code for fresh login)
            if client is None:
                try:
                    client = authenticate_garmin(garmin_email, garmin_password, garth_dir, mfa_code=mfa_code)
                    # Clear used MFA code if any
                    if mfa_code:
                        with get_conn() as conn:
                            with conn.cursor() as cur:
                                cur.execute(
                                    "UPDATE user_preferences SET value = '' WHERE user_id = %s AND key = 'garmin_mfa_code'",
                                    (user_id,),
                                )
                except GarminMFARequired as e:
                    # Store client state for later MFA resume
                    _garmin_mfa_pending[user_id] = (e.client, e.client_state)
                    # Set status so UI knows MFA is needed
                    with get_conn() as conn:
                        with conn.cursor() as cur:
                            cur.execute("""
                                INSERT INTO user_preferences (user_id, key, value)
                                VALUES (%s, 'garmin_mfa_status', 'required')
                                ON CONFLICT (user_id, key) DO UPDATE SET value = 'required'
                            """, (user_id,))
                    logger.warning("Garmin MFA required for user %s — waiting for code via UI.", user_id)
                    continue
                except Exception as e:
                    err_str = str(e)
                    # Detect 429 Too Many Requests and activate backoff
                    if "429" in err_str or "Too Many Requests" in err_str:
                        _garmin_429_backoff[user_id] = _time.time()
                        logger.warning("Garmin 429 rate limit for user %s — backoff %d min", user_id, _GARMIN_BACKOFF_SECONDS // 60)
                        _update_last_sync(user_id, user_email, "garmin", f"rate_limited: 429")
                    else:
                        logger.error("Garmin auth failed for user %s: %s", user_id, e)
                    continue

            # Clear MFA status on successful auth
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO user_preferences (user_id, key, value)
                        VALUES (%s, 'garmin_mfa_status', 'ok')
                        ON CONFLICT (user_id, key) DO UPDATE SET value = 'ok'
                    """, (user_id,))

            # Sync data
            set_current_user(user_email)
            try:
                with app_get_conn() as conn:
                    counts = sync_garmin_data(client, conn)
                    total = sum(v for k, v in counts.items() if k != "errors")
                    if total > 0:
                        logger.info("Garmin user %s: %s", user_id, counts)
                    _update_last_sync(user_id, user_email, "garmin", f"ok: {counts}")
                # Clear backoff on successful sync
                _garmin_429_backoff.pop(user_id, None)
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "Too Many Requests" in err_str:
                    _garmin_429_backoff[user_id] = _time.time()
                    logger.warning("Garmin 429 during sync for user %s — backoff %d min", user_id, _GARMIN_BACKOFF_SECONDS // 60)
                    _update_last_sync(user_id, user_email, "garmin", f"rate_limited: 429")
                else:
                    logger.error("Garmin sync data failed for user %s: %s", user_id, e)
                    _update_last_sync(user_id, user_email, "garmin", f"error: {e}")

            try:
                client.garth.dump(garth_dir)
            except Exception:
                pass

    except Exception as e:
        logger.error("sync_garmin failed: %s", e, exc_info=True)
