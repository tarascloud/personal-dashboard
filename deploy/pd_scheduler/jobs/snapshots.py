"""Weekly/monthly AI context snapshot generation.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

logger = logging.getLogger("scheduler")


def job_generate_snapshots():
    """Generate weekly/monthly snapshots for AI context."""
    logger.info("Running: generate_snapshots")
    try:
        from datetime import date, timedelta
        from src.database import set_current_user
        set_current_user(os.environ.get("OWNER_EMAIL", "admin@example.com"))

        from src.analytics import build_weekly_snapshot, build_monthly_snapshot
        from src.database import upsert_snapshot

        today = date.today()

        # Weekly snapshot (for previous week)
        prev_week = (today - timedelta(days=7))
        week_key = prev_week.strftime('%G-W%V')
        content = build_weekly_snapshot(week_key)
        if content:
            upsert_snapshot("week", week_key, "all", content)
            logger.info("Weekly snapshot generated: %s", week_key)

        # Monthly snapshot (on 1st of month, for previous month)
        if today.day <= 3:
            prev_month = (today.replace(day=1) - timedelta(days=1)).strftime('%Y-%m')
            content = build_monthly_snapshot(prev_month)
            if content:
                upsert_snapshot("month", prev_month, "all", content)
                logger.info("Monthly snapshot generated: %s", prev_month)
    except Exception as e:
        logger.error("generate_snapshots failed: %s", e, exc_info=True)
