"""Backward-compat shim for deploy/scheduler.py (DEV-20260507-0003).

The previous monolithic 1646 LOC scheduler was split into the pd_scheduler
package. This shim preserves the existing container CMD
(`python deploy/scheduler.py`) by simply delegating to pd_scheduler.main.

Tests, ad-hoc imports, and the production container all keep working.
"""

import os
import sys

# When invoked as `python deploy/scheduler.py`, the script's dir (deploy/) is
# on sys.path[0] but the project root (one level up) is not. The pd_scheduler
# package lives at deploy/pd_scheduler/, so deploy/ on path is correct.
# We additionally add the project root (= os.path.dirname(deploy)) so that
# `from src.* ...` and `from deploy.prod_to_dev_sync import ...` keep working
# the same way they did when scheduler.py contained those imports inline.
_DEPLOY_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_DEPLOY_DIR)
for _p in (_DEPLOY_DIR, _PROJECT_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from pd_scheduler.main import main  # noqa: E402

if __name__ == "__main__":
    main()
