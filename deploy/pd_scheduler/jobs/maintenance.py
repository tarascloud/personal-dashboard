"""Misc maintenance jobs: materialized views refresh, demo data, subscriptions, prod->dev sync.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging

from ..db import get_conn

logger = logging.getLogger("scheduler")


def job_refresh_views():
    """Refresh materialized views."""
    logger.info("Running: refresh_views")
    try:
        from src.materialized_views import refresh_views
        refresh_views()
    except Exception as e:
        logger.error("refresh_views failed: %s", e, exc_info=True)


def job_daily_demo_data():
    """Fill demo user data gaps (daily_log, garmin, transactions)."""
    logger.info("Running: daily_demo_data")
    try:
        from src.demo_data import fill_demo_data_gaps
        filled = fill_demo_data_gaps()
        if filled:
            logger.info("Demo data: filled %d days.", filled)
        else:
            logger.info("Demo data: no gaps to fill.")
    except Exception as e:
        logger.error("daily_demo_data failed: %s", e, exc_info=True)


def job_detect_subscriptions():
    """Auto-detect subscriptions from recurring transactions."""
    logger.info("Running: detect_subscriptions")
    try:
        from src.sync.detect_subscriptions import detect_subscriptions

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
                row = cur.fetchone()
                if not row:
                    logger.warning("detect_subscriptions: no owner user found")
                    return
                user_id = row[0]

            result = detect_subscriptions(conn, user_id)
            logger.info("detect_subscriptions: created=%d, updated=%d, skipped=%d",
                        result["created"], result["updated"], result["skipped"])
    except Exception as e:
        logger.error("detect_subscriptions failed: %s", e, exc_info=True)


def job_prod_to_dev_sync():
    """Sync user data from prod PostgreSQL to dev PostgreSQL."""
    logger.info("Running: prod_to_dev_sync")
    try:
        from deploy.prod_to_dev_sync import run_sync
        stats = run_sync()
        logger.info(
            "prod_to_dev_sync done: %d tables, %d rows, %d errors",
            stats["tables"], stats["rows"], stats["errors"],
        )
    except Exception as e:
        logger.error("prod_to_dev_sync failed: %s", e, exc_info=True)
