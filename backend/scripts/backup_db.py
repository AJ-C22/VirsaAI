#!/usr/bin/env python3
"""Dump the local Virsa Postgres database into backend/backups/."""
from __future__ import annotations

import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
_ROOT = _BACKEND.parent
_BACKUP_DIR = _BACKEND / "backups"


def _env(name: str, default: str) -> str:
    return (os.getenv(name) or default).strip()


def main() -> None:
    _BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = _BACKUP_DIR / f"virsa-{stamp}.sql"
    db = _env("POSTGRES_DB", "visra")
    user = _env("POSTGRES_USER", "postgres")
    password = _env("POSTGRES_PASSWORD", "mysecretpassword")
    host = _env("POSTGRES_HOST", "localhost")
    port = _env("POSTGRES_PORT", "5433")

    pg_dump = shutil.which("pg_dump")
    if pg_dump:
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        subprocess.run(
            [pg_dump, "-h", host, "-p", port, "-U", user, "-d", db, "-f", str(target)],
            check=True,
            env=env,
        )
    else:
        docker = shutil.which("docker") or "/usr/local/bin/docker"
        subprocess.run(
            [docker, "exec", "virsaai_db", "pg_dump", "-U", user, "-d", db],
            check=True,
            stdout=target.open("w"),
        )
    print(target)


if __name__ == "__main__":
    main()
