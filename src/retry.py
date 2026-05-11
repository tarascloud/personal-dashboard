"""Unified retry with exponential backoff for API calls."""
import asyncio
import time
import logging
from functools import wraps
from typing import Callable

_log = logging.getLogger(__name__)

DEFAULT_RETRIES = 3
DEFAULT_BACKOFF = [1, 3, 7]  # seconds


def retry_request(func: Callable, *args, retries: int = DEFAULT_RETRIES,
                  backoff: list[int] = DEFAULT_BACKOFF, **kwargs):
    """Execute func with exponential backoff retries.

    Used by AI client, Garmin sync, Withings sync, Monobank sync.
    """
    last_exc = None
    for attempt in range(retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last_exc = e
            if attempt < retries - 1:
                wait = backoff[min(attempt, len(backoff) - 1)]
                _log.warning("%s attempt %d/%d failed: %s. Retrying in %ds...",
                             func.__name__ if hasattr(func, '__name__') else 'call',
                             attempt + 1, retries, e, wait)
                time.sleep(wait)
    raise last_exc


def with_retry(retries: int = DEFAULT_RETRIES, backoff: list[int] = DEFAULT_BACKOFF):
    """Decorator: retry a function with exponential backoff."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return retry_request(func, *args, retries=retries, backoff=backoff, **kwargs)
        return wrapper
    return decorator


# ─── Circuit breaker for Telegram bot message sending ────────────────────────

# Module-level state: consecutive failure counter and cooldown timestamp
_tg_consecutive_failures: int = 0
_tg_circuit_open_until: float = 0.0  # time.monotonic() when circuit can close

CIRCUIT_BREAKER_THRESHOLD = 5   # open circuit after N consecutive failures
CIRCUIT_BREAKER_COOLDOWN = 60   # seconds to wait before retrying after circuit opens
TG_MAX_RETRIES = 5
TG_BACKOFF = [1, 2, 4, 8, 16]  # exponential backoff seconds


def _is_circuit_open() -> bool:
    """Check if the circuit breaker is currently open (blocking sends)."""
    if _tg_consecutive_failures < CIRCUIT_BREAKER_THRESHOLD:
        return False
    return time.monotonic() < _tg_circuit_open_until


def _record_tg_success():
    """Reset failure counter on successful send."""
    global _tg_consecutive_failures
    _tg_consecutive_failures = 0


def _record_tg_failure():
    """Increment failure counter; open circuit if threshold reached."""
    global _tg_consecutive_failures, _tg_circuit_open_until
    _tg_consecutive_failures += 1
    if _tg_consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD:
        _tg_circuit_open_until = time.monotonic() + CIRCUIT_BREAKER_COOLDOWN
        _log.warning(
            "Telegram circuit breaker OPEN after %d consecutive failures. "
            "Cooldown %ds.", _tg_consecutive_failures, CIRCUIT_BREAKER_COOLDOWN,
        )


TG_MESSAGE_LIMIT = 4096


def _split_tg_message(text: str) -> list[str]:
    """Split text into chunks of at most TG_MESSAGE_LIMIT chars.

    Splits at newline boundaries when possible.
    """
    if len(text) <= TG_MESSAGE_LIMIT:
        return [text]

    chunks: list[str] = []
    while text:
        if len(text) <= TG_MESSAGE_LIMIT:
            chunks.append(text)
            break
        split_pos = text.rfind("\n", 0, TG_MESSAGE_LIMIT)
        if split_pos <= 0:
            split_pos = TG_MESSAGE_LIMIT
        chunks.append(text[:split_pos])
        text = text[split_pos:].lstrip("\n")
    return chunks


def _is_bad_request(exc: Exception) -> bool:
    """Check if the exception is a Telegram BadRequest (HTTP 400).

    Works with python-telegram-bot's BadRequest exception and generic HTTP errors.
    """
    exc_type = type(exc).__name__
    exc_str = str(exc).lower()
    return (
        exc_type == "BadRequest"
        or "bad request" in exc_str
        or "can't parse" in exc_str
    )


async def tg_send_with_retry(coro_func, *args, **kwargs):
    """Send a Telegram message with exponential backoff and circuit breaker.

    Handles:
    - Messages longer than 4096 chars (splits into chunks)
    - Markdown parse errors (falls back to plain text on 400 BadRequest)
    - Exponential backoff with circuit breaker

    Usage:
        await tg_send_with_retry(context.bot.send_message,
                                 chat_id=user_id, text="Hello")

    Instead of:
        await context.bot.send_message(chat_id=user_id, text="Hello")

    Returns the result of the coroutine on success, or None if circuit is open
    or all retries are exhausted.
    """
    if _is_circuit_open():
        remaining = _tg_circuit_open_until - time.monotonic()
        _log.warning(
            "Telegram circuit breaker is OPEN. Skipping send. "
            "Retry in %.0fs.", max(remaining, 0),
        )
        return None

    # Split long messages into chunks
    text = kwargs.get("text", "")
    if text and len(text) > TG_MESSAGE_LIMIT:
        chunks = _split_tg_message(text)
        result = None
        for chunk in chunks:
            chunk_kwargs = dict(kwargs, text=chunk)
            result = await tg_send_with_retry(coro_func, *args, **chunk_kwargs)
        return result

    last_exc = None
    for attempt in range(TG_MAX_RETRIES):
        try:
            result = await coro_func(*args, **kwargs)
            _record_tg_success()
            return result
        except Exception as e:
            last_exc = e

            # On BadRequest (400) with parse_mode, retry without parse_mode
            # instead of burning retries on an unrecoverable parse error
            if _is_bad_request(e) and kwargs.get("parse_mode"):
                _log.warning(
                    "Telegram send failed with parse_mode=%s (BadRequest): %s. "
                    "Retrying without parse_mode.",
                    kwargs["parse_mode"], e,
                )
                fallback_kwargs = {k: v for k, v in kwargs.items() if k != "parse_mode"}
                try:
                    result = await coro_func(*args, **fallback_kwargs)
                    _record_tg_success()
                    return result
                except Exception as e2:
                    _log.warning("Telegram fallback (no parse_mode) also failed: %s", e2)
                    last_exc = e2

            _record_tg_failure()
            if _is_circuit_open():
                _log.error(
                    "Telegram send failed (attempt %d/%d): %s. Circuit breaker opened.",
                    attempt + 1, TG_MAX_RETRIES, e,
                )
                return None
            if attempt < TG_MAX_RETRIES - 1:
                wait = TG_BACKOFF[min(attempt, len(TG_BACKOFF) - 1)]
                _log.warning(
                    "Telegram send failed (attempt %d/%d): %s. Retrying in %ds...",
                    attempt + 1, TG_MAX_RETRIES, e, wait,
                )
                await asyncio.sleep(wait)

    _log.error("Telegram send failed after %d attempts: %s", TG_MAX_RETRIES, last_exc)
    return None
