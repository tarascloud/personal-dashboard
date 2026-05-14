"""Telegram bot integration: token loading, chat-id discovery, message send + chunking.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

from .db import get_conn

logger = logging.getLogger("scheduler")

TG_MAX_MESSAGE_LENGTH = 4096


def _get_bot_token() -> str | None:
    """Get bot token from DB (admin secret) or fall back to env var."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Look for the admin bot token in secrets table
                cur.execute("""
                    SELECT s.value FROM secrets s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.key = 'telegram_bot_token_admin' AND u.role = 'owner'
                    LIMIT 1
                """)
                row = cur.fetchone()
                if row and row[0]:
                    # Try to decrypt (handles both encrypted and plaintext)
                    try:
                        from src.encryption import decrypt_value
                        return decrypt_value(row[0])
                    except Exception:
                        return row[0]
    except Exception as e:
        logger.debug("Could not load bot token from DB: %s", e)
    return os.environ.get("TELEGRAM_BOT_TOKEN")


def _get_all_telegram_chat_ids() -> list[int]:
    """Get all linked Telegram chat IDs from DB."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT telegram_id FROM telegram_links WHERE telegram_id > 0")
                return [row[0] for row in cur.fetchall()]
    except Exception as e:
        logger.debug("Could not load telegram chat IDs: %s", e)
    # Fallback to env var
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if chat_id:
        return [int(chat_id)]
    return []


def _split_message(text: str, max_len: int = TG_MAX_MESSAGE_LENGTH) -> list[str]:
    """Split a long message into chunks respecting the Telegram limit.

    Splits at newline boundaries when possible to preserve formatting.
    """
    if len(text) <= max_len:
        return [text]

    chunks: list[str] = []
    while text:
        if len(text) <= max_len:
            chunks.append(text)
            break
        # Find last newline within the limit
        split_pos = text.rfind("\n", 0, max_len)
        if split_pos <= 0:
            # No newline found — hard split at max_len
            split_pos = max_len
        chunks.append(text[:split_pos])
        text = text[split_pos:].lstrip("\n")
    return chunks


def send_telegram_message(text, parse_mode="Markdown", chat_id=None):
    """Send Telegram message to a specific user or all linked users.

    Handles message length limits (splits into chunks if >4096 chars).
    Falls back to plain text if Markdown parsing fails (HTTP 400).
    """
    import requests

    token = _get_bot_token()
    if not token:
        return False

    # If specific chat_id provided, send only to that user
    if chat_id:
        chat_ids = [int(chat_id)]
    else:
        chat_ids = _get_all_telegram_chat_ids()

    if not chat_ids:
        return False

    chunks = _split_message(text)
    success = False
    for cid in chat_ids:
        for chunk in chunks:
            try:
                payload = {"chat_id": cid, "text": chunk}
                if parse_mode:
                    payload["parse_mode"] = parse_mode
                resp = requests.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json=payload,
                    timeout=15,
                )
                if resp.status_code == 400 and parse_mode:
                    # Markdown parsing failed — retry without parse_mode
                    logger.warning(
                        "Telegram send to %s failed with parse_mode=%s (400), retrying as plain text. "
                        "Response: %s",
                        cid, parse_mode, resp.text[:200],
                    )
                    payload.pop("parse_mode", None)
                    resp = requests.post(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        json=payload,
                        timeout=15,
                    )
                resp.raise_for_status()
                success = True
            except Exception as e:
                logger.error("Telegram send to %s failed: %s", cid, e)
    return success
