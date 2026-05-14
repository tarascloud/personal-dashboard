"""Weekly Telegram reports — plain summary + AI-powered narrative.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

from ...reports_builders import _build_weekly_report
from ...telegram import send_telegram_message

logger = logging.getLogger("scheduler")


def job_weekly_report():
    """Send weekly report via Telegram."""
    logger.info("Running: weekly_report")
    try:
        text = _build_weekly_report()
        if text:
            send_telegram_message(text)
            logger.info("Weekly report sent.")
    except Exception as e:
        logger.error("weekly_report failed: %s", e, exc_info=True)


def job_weekly_ai_report():
    """Send weekly AI-powered report via Telegram (Sunday 20:00)."""
    logger.info("Running: weekly_ai_report")
    try:
        from src.database import set_current_user
        set_current_user(os.environ.get("OWNER_EMAIL", "admin@example.com"))

        from src.analytics import build_weekly_report_context
        from src.claude_ai import generate_telegram_report

        context = build_weekly_report_context()
        if not context:
            logger.warning("weekly_ai_report: no context data")
            return

        report = generate_telegram_report(context, period_type="week")
        if report:
            send_telegram_message(report)
            logger.info("Weekly AI report sent (%d chars).", len(report))
        else:
            # Fallback: send raw data
            send_telegram_message(f"📊 *Тижневий звіт (raw data)*\n\n{context[:3500]}")
            logger.info("Weekly AI report: fallback to raw data.")
    except Exception as e:
        logger.error("weekly_ai_report failed: %s", e, exc_info=True)
