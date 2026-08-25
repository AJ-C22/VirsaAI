#!/usr/bin/env python3
"""Apply VirsaAI schemas to the configured Postgres database.

WARNING: schema.sql drops and recreates v2 tables (and legacy v1 names).
Back up first if you have data you care about.

Usage (from backend/):
  python apply_schema.py              # base + v2.1 + v2.2
  python apply_schema.py --base-only  # schema.sql only
  python apply_schema.py --migrate    # also run migrate_v1_to_v2.sql
  python apply_schema.py --rls        # also apply supabase_rls.sql
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
    parser.add_argument(
        "--base-only",
        action="store_true",
        help="Apply only schema.sql (skip living/commercial migrations)",
    )
    parser.add_argument(
        "--rls",
        action="store_true",
        help="Also apply supabase_rls.sql",
    )
    args = parser.parse_args()

    try:
        conn = connect()
    except Exception as e:
        print(f"Could not connect to Postgres: {e}", file=sys.stderr)
        print(
            "Start Docker first: cd docker && docker compose up -d db",
            file=sys.stderr,
        )
        sys.exit(1)

    conn.autocommit = False
    try:
        run_sql(conn, DB / "schema.sql")
        if args.migrate:
            run_sql(conn, DB / "migrate_v1_to_v2.sql")
        if not args.base_only:
            for name in (
                "schema_v2_1_living_platform.sql",
                "schema_v2_2_commercial.sql",
            ):
                path = DB / name
                if path.exists():
                    run_sql(conn, path)
                else:
                    print(f"⚠ Missing {name}, skipped", file=sys.stderr)
        if args.rls:
            rls = DB / "supabase_rls.sql"
            if rls.exists():
                run_sql(conn, rls)
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
