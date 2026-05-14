"""Logging + sys.path bootstrap. Imported at the top of pd_scheduler.main."""

import logging
import os
import sys

# Add project root to path (/app when running as `python -m pd_scheduler.main`).
# scheduler.py historically used os.path.dirname(os.path.dirname(...)) of itself.
# We sit one level deeper (deploy/pd_scheduler/), so we walk up two levels.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_THIS_DIR))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

logger = logging.getLogger("scheduler")
