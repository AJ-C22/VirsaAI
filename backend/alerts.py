"""
Write unexpected API errors to a local log. If ALERT_WEBHOOK_URL is set,
also POST a short JSON notice. Ordinary 4xx responses are not alerts.
"""
from __future__ import annotations

import json
import os
import traceback
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent


def _log_path() -> Path:
    raw = (os.getenv("ERROR_LOG_PATH") or "").strip()
    path = Path(raw) if raw else _BACKEND_DIR / "logs" / "errors.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def record_error(path: str, message: str, detail: str = "") -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = json.dumps({"time": stamp, "path": path, "message": message})
    with _log_path().open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")
        if detail:
            handle.write(detail.rstrip() + "\n")
    webhook = (os.getenv("ALERT_WEBHOOK_URL") or "").strip()
    if not webhook:
        return
    body = json.dumps({"text": f"Virsa error on {path}: {message}"}).encode()
    request = urllib.request.Request(
        webhook,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(request, timeout=5).close()
    except Exception:
        return


def format_exception(exc: BaseException) -> str:
    return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
