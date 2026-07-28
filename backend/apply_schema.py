#!/usr/bin/env python3
"""Apply VirsaAI v2 schema to the configured Postgres database.

WARNING: schema.sql drops and recreates v2 tables (and legacy v1 names).
Back up first if you have data you care about.

Usage (from backend/):
  python apply_schema.py
  python apply_schema.py --migrate   # also run migrate_v1_to_v2.sql
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg2

DB = Path(__file__).resolve().parent / "db"


def connect():
    return psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB", "visra"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "mysecretpassword"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5433"),
    )


def run_sql(conn, path: Path):
    print(f"→ Applying {path.name}")
    sql = path.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Also run migrate_v1_to_v2.sql (expects *_v1 tables)",
    )
    args = parser.parse_args()

    try:
        conn = connect()
    except Exception as e:
        print(f"Could not connect to Postgres: {e}", file=sys.stderr)
        print("Start Docker first: cd docker && docker compose up -d db", file=sys.stderr)
        sys.exit(1)

    conn.autocommit = False
    try:
        run_sql(conn, DB / "schema.sql")
        if args.migrate:
            run_sql(conn, DB / "migrate_v1_to_v2.sql")
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
            )
            tables = [r[0] for r in cur.fetchall()]
        print("OK. Tables:", ", ".join(tables))
    except Exception as e:
        conn.rollback()
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(2)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
