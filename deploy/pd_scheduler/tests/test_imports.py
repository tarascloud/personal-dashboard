"""Smoke tests: every module + every job callable must be importable.

Cannot exercise SQL / network / Ollama paths without prod env, but verifies
the refactor didn't break Python-level wiring (DEV-20260507-0003).
"""


def test_main_module_importable():
    import pd_scheduler.main
    assert callable(pd_scheduler.main.main)


def test_schedules_registry():
    from pd_scheduler.schedules import get_schedule
    schedule = get_schedule()
    # 17 active jobs — Garmin disabled, pg_backup removed (DEV-20260610-0041,
    # host-cron db-backup.sh is the single backup source). See schedules.py comments.
    assert len(schedule) == 17, f"Expected 17 active jobs, got {len(schedule)}"

    # All ids unique, all callables, all triggers valid (already validated by APScheduler later).
    ids = [s[0] for s in schedule]
    assert len(set(ids)) == len(ids), "Duplicate job ids in schedule"
    for job_id, fn, trigger in schedule:
        assert callable(fn), f"{job_id} fn not callable"
        assert trigger is not None, f"{job_id} trigger is None"


def test_sync_jobs():
    from pd_scheduler.jobs.sync.garmin import job_sync_garmin
    from pd_scheduler.jobs.sync.withings import job_sync_withings
    from pd_scheduler.jobs.sync.monobank import job_sync_monobank
    from pd_scheduler.jobs.sync.bunq import job_sync_bunq
    for fn in (job_sync_garmin, job_sync_withings, job_sync_monobank, job_sync_bunq):
        assert callable(fn)


def test_report_jobs():
    from pd_scheduler.jobs.reports.daily import job_daily_report
    from pd_scheduler.jobs.reports.weekly import job_weekly_report, job_weekly_ai_report
    from pd_scheduler.jobs.reports.monthly import job_monthly_ai_report
    from pd_scheduler.jobs.reports.mood import job_mood_reminder
    for fn in (job_daily_report, job_weekly_report, job_weekly_ai_report,
               job_monthly_ai_report, job_mood_reminder):
        assert callable(fn)


def test_insights_jobs():
    from pd_scheduler.jobs.insights import (
        PAGE_INSIGHT_PROMPTS,
        job_generate_ai_insights,
        job_improve_insight_prompts,
        job_weekly_insight_report,
        job_export_dpo_pairs,
    )
    assert "dashboard" in PAGE_INSIGHT_PROMPTS
    for fn in (job_generate_ai_insights, job_improve_insight_prompts,
               job_weekly_insight_report, job_export_dpo_pairs):
        assert callable(fn)


def test_other_jobs():
    from pd_scheduler.jobs.snapshots import job_generate_snapshots
    from pd_scheduler.jobs.maintenance import (
        job_refresh_views,
        job_daily_demo_data,
        job_detect_subscriptions,
        job_prod_to_dev_sync,
    )
    for fn in (job_generate_snapshots, job_refresh_views,
               job_daily_demo_data, job_detect_subscriptions, job_prod_to_dev_sync):
        assert callable(fn)


def test_on_conflict_clause_preserved():
    """DEV-20260507-0009 fix: ON CONFLICT (user_id, page, period, variant)
    must remain in job_generate_ai_insights — do not regress to (user_id, page, date)."""
    import inspect
    from pd_scheduler.jobs.insights.generate import job_generate_ai_insights
    src = inspect.getsource(job_generate_ai_insights)
    assert "ON CONFLICT (user_id, page, period, variant)" in src, (
        "ON CONFLICT clause from DEV-20260507-0009 was modified. "
        "Restore (user_id, page, period, variant)."
    )


def test_backward_compat_shim():
    """deploy/scheduler.py shim must still expose main()."""
    import importlib
    import importlib.util
    import os
    shim_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "scheduler.py",
    )
    assert os.path.exists(shim_path), f"shim not found at {shim_path}"
    spec = importlib.util.spec_from_file_location("_shim", shim_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert callable(mod.main)
