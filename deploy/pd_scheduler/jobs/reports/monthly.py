"""Monthly AI-powered Telegram report.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

from ...telegram import send_telegram_message

logger = logging.getLogger("scheduler")


def job_monthly_ai_report():
    """Send monthly AI-powered report via Telegram (1st of month 10:00)."""
    logger.info("Running: monthly_ai_report")
    try:
        from datetime import date, timedelta
        from src.database import set_current_user
        set_current_user(os.environ.get("OWNER_EMAIL", "admin@example.com"))

        from src.analytics import build_monthly_report_context
        from src.claude_ai import generate_telegram_report

        prev_month = (date.today().replace(day=1) - timedelta(days=1)).strftime('%Y-%m')
        context = build_monthly_report_context(prev_month)
        if not context:
            logger.warning("monthly_ai_report: no context data")
            return

        report = generate_telegram_report(context, period_type="month")
        if report:
            send_telegram_message(report)
            logger.info("Monthly AI report sent for %s (%d chars).", prev_month, len(report))
        else:
            send_telegram_message(f"📊 *Місячний звіт {prev_month} (raw data)*\n\n{context[:3500]}")
            logger.info("Monthly AI report: fallback to raw data.")
    except Exception as e:
        logger.error("monthly_ai_report failed: %s", e, exc_info=True)
