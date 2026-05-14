"""Entry point for pd-scheduler container.

Run as: `python -m pd_scheduler.main` or via the backward-compat shim
`python deploy/scheduler.py`.
"""

# logging_setup must be imported first — it bootstraps sys.path + load_dotenv +
# logging.basicConfig, all of which scheduler.py used to do at module top level.
from . import logging_setup  # noqa: F401

import logging
import signal

from apscheduler.schedulers.blocking import BlockingScheduler

from .schedules import get_schedule

logger = logging.getLogger("scheduler")


def main():
    scheduler = BlockingScheduler(timezone="UTC")

    for job_id, fn, trigger in get_schedule():
        scheduler.add_job(fn, trigger, id=job_id)

    logger.info("Scheduler started with %d jobs.", len(scheduler.get_jobs()))
    for job in scheduler.get_jobs():
        logger.info("  %s: %s", job.id, job.trigger)

    # Graceful shutdown
    def _shutdown(signum, frame):
        logger.info("Shutting down scheduler...")
        scheduler.shutdown(wait=False)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    scheduler.start()


if __name__ == "__main__":
    main()
