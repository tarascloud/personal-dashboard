"""PostgreSQL pg_dump backup job with daily/monthly rotation.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import logging
import os

logger = logging.getLogger("scheduler")


def job_pg_backup():
    """Run pg_dump and rotate backups (30 daily + 12 monthly)."""
    logger.info("Running: pg_backup")
    try:
        import subprocess
        from datetime import date, timedelta
        from pathlib import Path

        backup_dir = Path("/backups")
        backup_dir.mkdir(parents=True, exist_ok=True)

        today = date.today()
        daily_file = backup_dir / f"daily_{today.isoformat()}.sql.gz"

        db_url = os.environ.get("DATABASE_URL", "")
        # Use subprocess list args to avoid shell injection via DATABASE_URL
        with open(daily_file, "wb") as f:
            pg_dump = subprocess.Popen(
                ["pg_dump", db_url],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            gzip_proc = subprocess.Popen(
                ["gzip"],
                stdin=pg_dump.stdout, stdout=f, stderr=subprocess.PIPE,
            )
            pg_dump.stdout.close()
            _, gzip_err = gzip_proc.communicate(timeout=300)
            pg_dump.wait(timeout=10)
        if pg_dump.returncode != 0:
            logger.error("pg_dump failed: %s", pg_dump.stderr.read().decode() if pg_dump.stderr else "")
            daily_file.unlink(missing_ok=True)
            return
        if gzip_proc.returncode != 0:
            logger.error("gzip failed: %s", gzip_err.decode() if gzip_err else "")
            daily_file.unlink(missing_ok=True)
            return

        size_mb = daily_file.stat().st_size / (1024 * 1024)
        logger.info("Backup created: %s (%.1f MB)", daily_file.name, size_mb)

        # Monthly backup on 1st of month
        if today.day == 1:
            monthly_file = backup_dir / f"monthly_{today.strftime('%Y-%m')}.sql.gz"
            import shutil
            shutil.copy2(str(daily_file), str(monthly_file))
            logger.info("Monthly backup: %s", monthly_file.name)

        # Rotate: keep 30 daily
        cutoff_daily = today - timedelta(days=30)
        for f in sorted(backup_dir.glob("daily_*.sql.gz")):
            try:
                fdate = date.fromisoformat(f.stem.replace("daily_", ""))
                if fdate < cutoff_daily:
                    f.unlink()
                    logger.info("Rotated old backup: %s", f.name)
            except (ValueError, OSError):
                pass

        # Rotate: keep 12 monthly
        monthly_files = sorted(backup_dir.glob("monthly_*.sql.gz"), reverse=True)
        for f in monthly_files[12:]:
            f.unlink()
            logger.info("Rotated old monthly backup: %s", f.name)

    except Exception as e:
        logger.error("pg_backup failed: %s", e, exc_info=True)
