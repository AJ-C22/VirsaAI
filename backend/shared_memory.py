"""
Link timeline events across stories into shared memories (multi-perspective).
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple


def _normalize(text: str) -> str:
    t = (text or "").lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _tokens(text: str) -> set:
    stop = {
        "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for",
        "with", "my", "our", "his", "her", "their", "was", "were", "is",
    }
    return {w for w in _normalize(text).split() if len(w) > 2 and w not in stop}


def event_similarity(a: Dict, b: Dict) -> float:
    """Score 0..1 for whether two timeline events are the same real-world moment."""
    score = 0.0
    year_a, year_b = a.get("year"), b.get("year")
    if year_a and year_b:
        if year_a == year_b:
            score += 0.45
        elif abs(int(year_a) - int(year_b)) <= 1:
            score += 0.25
        else:
            return 0.0  # different years → not the same memory
    elif not year_a and not year_b:
        score += 0.1
    else:
        score += 0.05

    place_a = _normalize(a.get("place") or a.get("location") or "")
    place_b = _normalize(b.get("place") or b.get("location") or "")
    if place_a and place_b:
        if place_a == place_b or place_a in place_b or place_b in place_a:
            score += 0.25

    title_a = a.get("title") or a.get("event") or ""
    title_b = b.get("title") or b.get("event") or ""
    ta, tb = _tokens(title_a), _tokens(title_b)
    if ta and tb:
        overlap = len(ta & tb) / max(len(ta | tb), 1)
        score += 0.3 * overlap

    cat_a = (a.get("category") or "").lower()
    cat_b = (b.get("category") or "").lower()
    if cat_a and cat_b and cat_a == cat_b:
        score += 0.1

    return min(score, 1.0)


def cluster_events(
    events: List[Dict], threshold: float = 0.55
) -> List[List[Dict]]:
    """
    Greedy clustering of events into shared-memory groups.
    Each event dict needs: id, year, title/event, place/location, category,
    and ideally person_id, source_story_id.
    """
    unused = list(events)
    clusters: List[List[Dict]] = []

    while unused:
        seed = unused.pop(0)
        group = [seed]
        rest = []
        for ev in unused:
            # Don't merge two events from the exact same story+person unnecessarily
            # unless they look like duplicates — still allow cross-story only preference
            best = max(event_similarity(seed, ev), max((event_similarity(g, ev) for g in group), default=0))
            if best >= threshold:
                group.append(ev)
            else:
                rest.append(ev)
        unused = rest
        clusters.append(group)

    return clusters


def cluster_title(group: List[Dict]) -> str:
    # Prefer the longest title
    titles = [(ev.get("title") or ev.get("event") or "Shared memory") for ev in group]
    return max(titles, key=len)
