"""
Database initialization script.
Creates the database schema from schema.sql file.
Safe to run multiple times (idempotent).
"""
import psycopg2
import pathlib
import os
from dotenv import load_dotenv
from psycopg2.errors import DuplicateTable

load_dotenv()

def run_sql_file(path):
    """
    Execute SQL commands from a file.
    Handles duplicate table errors gracefully (idempotent).
    """
    sql = pathlib.Path(path).read_text()

    conn = psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB", "visra"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "mysecretpassword"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5433"),
    )

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql)
        print(f"✓ Successfully executed SQL from {path}")
    except DuplicateTable:
        print(f"✓ Tables already exist in database (schema.sql already applied)")
    except Exception as e:
        print(f"✗ Error executing SQL: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_sql_file("db/schema.sql")
