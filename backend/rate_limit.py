"""Small in-memory limit so login, invites, and uploads cannot be hammered."""
from __future__ import annotations

import threading
import time
from typing import Dict, List

_LOCK = threading.Lock()
_HITS: Dict[str, List[float]] = {}


def allow(key: str, limit: int, window_seconds: float = 60) -> bool:
    now = time.monotonic()
    with _LOCK:
        recent = [stamp for stamp in _HITS.get(key, []) if now - stamp < window_seconds]
        if len(recent) >= limit:
            _HITS[key] = recent
            return False
        recent.append(now)
        _HITS[key] = recent
        return True


def reset_limits() -> None:
    with _LOCK:
        _HITS.clear()
