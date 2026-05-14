"""Cron schedule registry for pd_scheduler.

Each entry: (job_id, callable, trigger). Triggers are constructed lazily by
factory closures so APScheduler is imported only once in main.py.

DO NOT change any cron expression here without explicit approval — these are
preserved verbatim from the original deploy/scheduler.py main() function.
"""

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from .jobs.backups import job_pg_backup
from .jobs.insights import (
    job_export_dpo_pairs,
    job_generate_ai_insights,
    job_improve_insight_prompts,
    job_weekly_insight_report,
)
from .jobs.maintenance import (
    job_daily_demo_data,
    job_detect_subscriptions,
    job_prod_to_dev_sync,
    job_refresh_views,
)
from .jobs.reports.daily import job_daily_report
from .jobs.reports.monthly import job_monthly_ai_report
from .jobs.reports.mood import job_mood_reminder
from .jobs.reports.weekly import job_weekly_ai_report, job_weekly_report
from .jobs.snapshots import job_generate_snapshots
from .jobs.sync.bunq import job_sync_bunq

# Garmin import kept for reachability via `from pd_scheduler.jobs.sync.garmin import ...`
# even though the schedule entry is currently disabled.
from .jobs.sync.garmin import job_sync_garmin  # noqa: F401
from .jobs.sync.monobank import job_sync_monobank
from .jobs.sync.withings import job_sync_withings


def get_schedule():
    """Return list of (job_id, callable, trigger) tuples.

    Cron expressions preserved verbatim from deploy/scheduler.py main().
    """
    return [
        # NOTE: sync_garmin is intentionally DISABLED until fresh garth session
        # restored from Mac (VPN/hotspot to avoid home-IP 429). Target schedule:
        # CronTrigger(hour=6, minute=0) — once/day at 06:00 UTC (= 08:00 Madrid CEST).
        # Re-enable after scp tokens to /opt/docker/pd-scheduler/garth_sessions/1/.
        # ("sync_garmin", job_sync_garmin, CronTrigger(hour=6, minute=0)),

        ("sync_withings",         job_sync_withings,         CronTrigger(minute="*/15")),
        ("sync_monobank",         job_sync_monobank,         CronTrigger(minute="*/10", hour="7-23")),
        ("sync_bunq",             job_sync_bunq,             CronTrigger(minute="*/10", hour="7-23")),
        ("daily_report",          job_daily_report,          CronTrigger(hour=21, minute=0)),
        ("weekly_report",         job_weekly_report,         CronTrigger(day_of_week="mon", hour=10, minute=0)),
        ("mood_reminder",         job_mood_reminder,         CronTrigger(hour="12,18", minute=0)),
        ("pg_backup",             job_pg_backup,             CronTrigger(hour=3, minute=0)),
        ("refresh_views",         job_refresh_views,         CronTrigger(minute="*/30")),
        ("daily_demo_data",       job_daily_demo_data,       CronTrigger(hour=2, minute=0)),
        ("detect_subscriptions",  job_detect_subscriptions,  CronTrigger(hour=12, minute=0)),
        ("prod_to_dev_sync",      job_prod_to_dev_sync,      IntervalTrigger(hours=2)),

        # AI reports & snapshots
        ("weekly_ai_report",        job_weekly_ai_report,        CronTrigger(day_of_week="sun", hour=20, minute=0)),
        ("monthly_ai_report",       job_monthly_ai_report,       CronTrigger(day=1, hour=10, minute=0)),
        ("generate_snapshots",      job_generate_snapshots,      CronTrigger(day_of_week="mon", hour=3, minute=30)),
        ("ai_insights",             job_generate_ai_insights,    CronTrigger(hour=0, minute=15)),
        ("improve_insight_prompts", job_improve_insight_prompts, CronTrigger(day_of_week="mon", hour=4, minute=0)),
        ("weekly_insight_report",   job_weekly_insight_report,   CronTrigger(day_of_week="sun", hour=20, minute=30)),
        ("export_dpo_pairs",        job_export_dpo_pairs,        CronTrigger(day_of_week="mon", hour=5, minute=0)),
    ]
