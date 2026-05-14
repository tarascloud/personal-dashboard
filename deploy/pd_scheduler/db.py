"""Database connection pool + transactional context manager.

Extracted verbatim from deploy/scheduler.py (DEV-20260507-0003).
"""

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.pool

_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1, maxconn=10,
            dsn=os.environ["DATABASE_URL"],
        )
    return _pool


@contextmanager
def get_conn():
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
