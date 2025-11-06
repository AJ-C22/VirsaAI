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
    'dbname': os.getenv('POSTGRES_DB', 'visra'),
    'user': os.getenv('POSTGRES_USER', 'postgres'),
    'password': os.getenv('POSTGRES_PASSWORD', 'mysecretpassword'),
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': os.getenv('POSTGRES_PORT', '5433'),  # Default to 5433 for localhost
}

# Connection pool (optional, for production use)
_connection_pool = None


def get_connection_pool():
    """Initialize and return a connection pool."""
    global _connection_pool
    if _connection_pool is None:
        try:
            _connection_pool = psycopg2.pool.SimpleConnectionPool(
                1, 20,  # min 1, max 20 connections
                **DB_CONFIG
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
    
    Usage:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM stories")
    """
    conn = None
    try:
        # Try to use connection pool if available
        pool = get_connection_pool()
        if pool:
            conn = pool.getconn()
        else:
            # Fallback to direct connection
            conn = psycopg2.connect(**DB_CONFIG)
        
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Database error: {e}")
        raise
    finally:
        if conn:
            # Return connection to pool if using pool
            pool = get_connection_pool()
            if pool:
                pool.putconn(conn)
            else:
                conn.close()


def close_all_connections():
    """Close all connections in the pool."""
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None

