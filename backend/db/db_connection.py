"""
Database connection and utility functions for VirsaAI.
"""
import os
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
# When running locally (outside Docker), use port 5433 (host port)
# When running in Docker, use port 5432 (container port)
DB_CONFIG = {
    "dbname": os.getenv("POSTGRES_DB", "visra"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "mysecretpassword"),
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": os.getenv("POSTGRES_PORT", "5433"),  # Default to 5433 for localhost
}

_connection_pool = None


def get_connection_pool():
    """Initialize and return a connection pool."""
    global _connection_pool
    if _connection_pool is None:
        try:
            _connection_pool = psycopg2.pool.SimpleConnectionPool(
                1, 20, **DB_CONFIG
            )
        except Exception as e:
            print(f"Error creating connection pool: {e}")
            return None
    return _connection_pool


@contextmanager
def get_db_connection():
    """
    Context manager for database connections.
    Automatically commits or rolls back transactions.
    """
    pool_obj = get_connection_pool()
    conn = None
    from_pool = False
    try:
        if pool_obj is not None:
            conn = pool_obj.getconn()
            from_pool = True
        else:
            conn = psycopg2.connect(**DB_CONFIG)

        try:
            yield conn
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
    finally:
        if conn is None:
            return
        if from_pool and pool_obj is not None:
            try:
                pool_obj.putconn(conn)
            except Exception as e:
                # Pool can get into a bad state after aborted connections;
                # close and drop the pool so the next request recreates it.
                print(f"Pool return error (resetting pool): {e}")
                try:
                    conn.close()
                except Exception:
                    pass
                try:
                    pool_obj.closeall()
                except Exception:
                    pass
                global _connection_pool
                _connection_pool = None
        else:
            try:
                conn.close()
            except Exception:
                pass


def close_all_connections():
    """Close all connections in the pool."""
    global _connection_pool
    if _connection_pool:
        try:
            _connection_pool.closeall()
        except Exception:
            pass
        _connection_pool = None
