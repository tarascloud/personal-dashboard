"""Daily evening Telegram report.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from ...reports_builders import _build_daily_report
from ...telegram import send_telegram_message

logger = logging.getLogger("scheduler")


def job_daily_report():
    """Send daily evening report via Telegram."""
    logger.info("Running: daily_report")
    try:
        text = _build_daily_report()
        if text:
            send_telegram_message(text)
            logger.info("Daily report sent.")
    except Exception as e:
        logger.error("daily_report failed: %s", e, exc_info=True)
