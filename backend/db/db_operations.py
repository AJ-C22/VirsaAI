"""
VirsaAI v2 database operations — vault + person-centric model.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from .db_connection import get_db_connection

DEFAULT_VAULT_ID = "00000000-0000-0000-0000-000000000001"

_REL_MAP = {
    "father": "parent",
    "mother": "parent",
    "dad": "parent",
    "mom": "parent",
    "parent": "parent",
    "son": "child",
    "daughter": "child",
    "child": "child",
    "spouse": "spouse",
    "wife": "spouse",
    "husband": "spouse",
    "partner": "spouse",
    "brother": "sibling",
    "sister": "sibling",
    "sibling": "sibling",
    "grandfather": "grandparent",
    "grandmother": "grandparent",
    "grandparent": "grandparent",
    "grandson": "grandchild",
    "granddaughter": "grandchild",
    "grandchild": "grandchild",
    "uncle": "aunt_uncle",
    "aunt": "aunt_uncle",
    "nephew": "niece_nephew",
    "niece": "niece_nephew",
    "cousin": "cousin",
    "in-law": "in_law",
    "in_law": "in_law",
    "relative": "relative",
}


def _as_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def _json(value: Any) -> Optional[str]:
    if value is None:
        return None
    return json.dumps(value)


def _loads(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return None


def normalize_relationship_type(label: Optional[str]) -> str:
    if not label:
        return "relative"
    key = label.strip().lower()
    if key in _REL_MAP:
        return _REL_MAP[key]
    # fuzzy contains
    for token, mapped in _REL_MAP.items():
        if token in key:
            return mapped
    return "other"


def ensure_default_vault(cur) -> str:
    cur.execute(
        """
        INSERT INTO family_vaults (id, name, description)
        VALUES (%s, 'Default Family Vault', 'Local development vault')
        ON CONFLICT (id) DO NOTHING
        RETURNING id
        """,
        (DEFAULT_VAULT_ID,),
    )
    row = cur.fetchone()
    return row[0] if row else DEFAULT_VAULT_ID


def get_or_create_person_by_name(
    cur,
    vault_id: str,
    display_name: str,
    birth_year: Optional[int] = None,
    death_year: Optional[int] = None,
    birth_place: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """Find an existing person in the vault by case-insensitive name, else create."""
    name = (display_name or "Unknown").strip()
    cur.execute(
        """
        SELECT id FROM persons
        WHERE vault_id = %s AND lower(display_name) = lower(%s)
        LIMIT 1
        """,
        (vault_id, name),
    )
    row = cur.fetchone()
    if row:
        return str(row[0])

    cur.execute(
        """
        INSERT INTO persons (
            vault_id, display_name, birth_year, death_year, birth_place, notes
        ) VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (vault_id, name, birth_year, death_year, birth_place, notes),
    )
    return str(cur.fetchone()[0])


def _insert_relationship(
    cur,
    vault_id: str,
    from_person_id: str,
    to_person_id: str,
    rel_type: str,
    source_story_id: Optional[str] = None,
    certainty: float = 0.8,
) -> Optional[str]:
    if from_person_id == to_person_id:
        return None
    cur.execute(
        """
        INSERT INTO relationships (
            vault_id, from_person_id, to_person_id, type,
            source_story_id, certainty
        ) VALUES (%s, %s, %s, %s::relationship_type, %s, %s)
        ON CONFLICT (from_person_id, to_person_id, type) DO UPDATE
            SET certainty = GREATEST(relationships.certainty, EXCLUDED.certainty)
        RETURNING id
        """,
        (vault_id, from_person_id, to_person_id, rel_type, source_story_id, certainty),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def _edge_for_label(
    subject_id: str, other_id: str, label: str
) -> Tuple[str, str, str]:
    """
    Map AI 'relationship to subject' label into (from_id, to_id, type).
    e.g. label=father → from=other(parent), to=subject, type=parent
    """
    rel_type = normalize_relationship_type(label)
    if rel_type in ("parent", "grandparent", "aunt_uncle"):
        return other_id, subject_id, rel_type
    if rel_type in ("child", "grandchild", "niece_nephew"):
        return subject_id, other_id, rel_type
    return subject_id, other_id, rel_type


# ---------------------------------------------------------------------------
# Save / ingest
# ---------------------------------------------------------------------------
def save_story(
    person_name: str,
    raw_body: str,
    story: str,
    summary: Optional[str] = None,
    extracted_data: Optional[Dict] = None,
    vault_id: str = DEFAULT_VAULT_ID,
) -> Optional[str]:
    """Create a minimal ready story + subject person."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                ensure_default_vault(cur)
                person_id = get_or_create_person_by_name(cur, vault_id, person_name)
                cur.execute(
                    """
                    INSERT INTO stories (
                        vault_id, subject_person_id, title, status,
                        transcript, biography, summary, extracted_data
                    ) VALUES (%s, %s, %s, 'ready', %s, %s, %s, %s::jsonb)
                    RETURNING id
                    """,
                    (
                        vault_id,
                        person_id,
                        person_name or "Untitled story",
                        raw_body,
                        story,
                        summary,
                        _json(extracted_data),
                    ),
                )
                return str(cur.fetchone()[0])
    except Exception as e:
        print(f"Error saving story: {e}")
        return None


def save_complete_story(
    person_name: str,
    raw_body: str,
    story: str,
    summary: str,
    extracted_data: Dict,
    vault_id: str = DEFAULT_VAULT_ID,
    auto_confirm: bool = True,
) -> Optional[str]:
    """
    Persist a fully processed oral history into the v2 model.

    - Creates/finds subject person
    - Creates story (status=ready)
    - Writes timeline / occupations / places on the person
    - Creates relative persons + relationships
    - Always stores ai_suggestions (accepted if auto_confirm else pending)
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                ensure_default_vault(cur)
                person_info = (extracted_data or {}).get("person_info") or {}
                display = (
                    person_name
                    or person_info.get("name")
                    or "Unknown"
                )

                subject_id = get_or_create_person_by_name(
                    cur,
                    vault_id,
                    display,
                    birth_year=person_info.get("birth_year"),
                    death_year=person_info.get("death_year"),
                    birth_place=person_info.get("birth_place"),
                )

                # Refresh subject demographics if we have better data
                cur.execute(
                    """
                    UPDATE persons SET
                        birth_year = COALESCE(%s, birth_year),
                        death_year = COALESCE(%s, death_year),
                        birth_place = COALESCE(%s, birth_place)
                    WHERE id = %s
                    """,
                    (
                        person_info.get("birth_year"),
                        person_info.get("death_year"),
                        person_info.get("birth_place"),
                        subject_id,
                    ),
                )

                fact_status = "confirmed" if auto_confirm else "suggested"
                suggestion_status = "accepted" if auto_confirm else "pending"

                cur.execute(
                    """
                    INSERT INTO stories (
                        vault_id, subject_person_id, title, status,
                        transcript, biography, summary, extracted_data
                    ) VALUES (%s, %s, %s, 'ready', %s, %s, %s, %s::jsonb)
                    RETURNING id
                    """,
                    (
                        vault_id,
                        subject_id,
                        display,
                        raw_body,
                        story,
                        summary,
                        _json(extracted_data),
                    ),
                )
                story_id = str(cur.fetchone()[0])

                # Timeline
                for event in (extracted_data or {}).get("timeline_events") or []:
                    title = event.get("event") or event.get("title") or "Event"
                    cur.execute(
                        """
                        INSERT INTO timeline_events (
                            vault_id, person_id, source_story_id, year, title,
                            description, place, category, status
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::fact_status)
                        RETURNING id
                        """,
                        (
                            vault_id,
                            subject_id,
                            story_id,
                            event.get("year"),
                            title,
                            event.get("description"),
                            event.get("location") or event.get("place"),
                            event.get("category"),
                            fact_status,
                        ),
                    )
                    event_id = str(cur.fetchone()[0])
                    cur.execute(
                        """
                        INSERT INTO ai_suggestions (
                            vault_id, story_id, kind, payload, status, resolved_entity_id
                        ) VALUES (%s, %s, 'timeline_event', %s::jsonb, %s::suggestion_status, %s)
                        """,
                        (
                            vault_id,
                            story_id,
                            _json(event),
                            suggestion_status,
                            event_id if auto_confirm else None,
                        ),
                    )

                # Family members → persons + relationships
                for member in (extracted_data or {}).get("family_members") or []:
                    m_name = member.get("name") or "Unknown relative"
                    other_id = get_or_create_person_by_name(
                        cur,
                        vault_id,
                        m_name,
                        birth_year=member.get("birth_year"),
                        death_year=member.get("death_year"),
                        notes=member.get("notes"),
                    )
                    frm, to, rel_type = _edge_for_label(
                        subject_id, other_id, member.get("relationship") or "relative"
                    )
                    rel_id = _insert_relationship(
                        cur, vault_id, frm, to, rel_type, story_id, certainty=0.75
                    )
                    cur.execute(
                        """
                        INSERT INTO ai_suggestions (
                            vault_id, story_id, kind, payload, status, resolved_entity_id
                        ) VALUES (%s, %s, 'relationship', %s::jsonb, %s::suggestion_status, %s)
                        """,
                        (
                            vault_id,
                            story_id,
                            _json({**member, "person_id": other_id, "relationship_id": rel_id}),
                            suggestion_status,
                            rel_id if auto_confirm else None,
                        ),
                    )

                # Places
                for location in (extracted_data or {}).get("locations") or []:
                    cur.execute(
                        """
                        INSERT INTO places (
                            vault_id, person_id, source_story_id, place,
                            start_year, end_year, purpose, status
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::fact_status)
                        RETURNING id
                        """,
                        (
                            vault_id,
                            subject_id,
                            story_id,
                            location.get("place"),
                            location.get("start_year"),
                            location.get("end_year"),
                            location.get("purpose"),
                            fact_status,
                        ),
                    )
                    place_id = str(cur.fetchone()[0])
                    cur.execute(
                        """
                        INSERT INTO ai_suggestions (
                            vault_id, story_id, kind, payload, status, resolved_entity_id
                        ) VALUES (%s, %s, 'place', %s::jsonb, %s::suggestion_status, %s)
                        """,
                        (
                            vault_id,
                            story_id,
                            _json(location),
                            suggestion_status,
                            place_id if auto_confirm else None,
                        ),
                    )

                # Occupations
                for occupation in (extracted_data or {}).get("occupations") or []:
                    cur.execute(
                        """
                        INSERT INTO occupations (
                            vault_id, person_id, source_story_id, role,
                            start_year, end_year, location, status
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::fact_status)
                        RETURNING id
                        """,
                        (
                            vault_id,
                            subject_id,
                            story_id,
                            occupation.get("role"),
                            occupation.get("start_year"),
                            occupation.get("end_year"),
                            occupation.get("location"),
                            fact_status,
                        ),
                    )
                    occ_id = str(cur.fetchone()[0])
                    cur.execute(
                        """
                        INSERT INTO ai_suggestions (
                            vault_id, story_id, kind, payload, status, resolved_entity_id
                        ) VALUES (%s, %s, 'occupation', %s::jsonb, %s::suggestion_status, %s)
                        """,
                        (
                            vault_id,
                            story_id,
                            _json(occupation),
                            suggestion_status,
                            occ_id if auto_confirm else None,
                        ),
                    )

                # Themes
                for theme_name in (extracted_data or {}).get("themes") or []:
                    if not theme_name:
                        continue
                    cur.execute(
                        "INSERT INTO themes (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
                        (theme_name,),
                    )
                    theme_id = cur.fetchone()[0]
                    cur.execute(
                        """
                        INSERT INTO story_themes (story_id, theme_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING
                        """,
                        (story_id, theme_id),
                    )

                return story_id
    except Exception as e:
        print(f"Error saving complete story: {e}")
        import traceback

        traceback.print_exc()
        return None


# ---------------------------------------------------------------------------
# Stories
# ---------------------------------------------------------------------------
def get_story(story_id: str) -> Optional[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.id, COALESCE(p.display_name, s.title, 'Unknown'),
                           s.biography, s.transcript, s.created_at, s.updated_at,
                           s.subject_person_id, s.summary, s.status, s.vault_id
                    FROM stories s
                    LEFT JOIN persons p ON p.id = s.subject_person_id
                    WHERE s.id = %s
                    """,
                    (story_id,),
                )
                row = cur.fetchone()
        if not row:
            return None
        return {
            "story_id": str(row[0]),
            "person_name": row[1] or "Unknown",
            "story": row[2] or "",
            "raw_body": row[3] or "",
            "created_at": row[4],
            "updated_at": row[5],
            "subject_person_id": _as_str(row[6]),
            "summary": row[7],
            "status": row[8],
            "vault_id": _as_str(row[9]),
        }
    except Exception as e:
        print("Error retrieving story (simple):", e)
        return None


def get_story_full(story_id: str) -> Optional[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.id, s.vault_id, s.subject_person_id, s.title, s.status,
                           s.transcript, s.biography, s.summary, s.extracted_data,
                           s.created_at, s.updated_at,
                           p.display_name, p.birth_year, p.birth_place, p.death_year
                    FROM stories s
                    LEFT JOIN persons p ON p.id = s.subject_person_id
                    WHERE s.id = %s
                    """,
                    (story_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None

                subject_id = row[2]
                story_obj: Dict[str, Any] = {
                    "id": str(row[0]),
                    "vault_id": str(row[1]),
                    "subject_person_id": _as_str(subject_id),
                    "title": row[3],
                    "status": row[4],
                    "person_name": row[11] or row[3] or "Unknown",
                    "raw_body": row[5],
                    "story": row[6],
                    "summary": row[7],
                    "extracted_data": _loads(row[8]),
                    "created_at": row[9],
                    "updated_at": row[10],
                }
                if subject_id:
                    story_obj["person"] = {
                        "id": str(subject_id),
                        "name": row[11],
                        "birth_year": row[12],
                        "birth_place": row[13],
                        "death_year": row[14],
                    }
                    story_obj["timeline_events"] = _fetch_timeline_for_person(
                        cur, str(subject_id), confirmed_only=False
                    )
                    story_obj["occupations"] = _fetch_occupations(cur, str(subject_id))
                    story_obj["locations"] = _fetch_places(cur, str(subject_id))

                cur.execute(
                    """
                    SELECT t.id, t.name FROM themes t
                    JOIN story_themes st ON st.theme_id = t.id
                    WHERE st.story_id = %s
                    """,
                    (story_id,),
                )
                story_obj["themes"] = [
                    {"id": str(r[0]), "name": r[1]} for r in cur.fetchall()
                ]
                return story_obj
    except Exception as e:
        print(f"Error retrieving story: {e}")
        import traceback

        traceback.print_exc()
        return None


def get_all_stories(vault_id: str = DEFAULT_VAULT_ID) -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.id,
                           COALESCE(p.display_name, s.title, 'Unknown'),
                           LENGTH(COALESCE(s.transcript, '')),
                           s.biography,
                           s.created_at,
                           s.updated_at,
                           s.summary,
                           s.status,
                           s.subject_person_id
                    FROM stories s
                    LEFT JOIN persons p ON p.id = s.subject_person_id
                    WHERE s.vault_id = %s
                    ORDER BY s.updated_at DESC
                    """,
                    (vault_id,),
                )
                rows = cur.fetchall()
        return [
            {
                "story_id": str(r[0]),
                "person_name": r[1] or "Unknown",
                "character_count": r[2] or 0,
                "story": r[3] or "",
                "created_at": r[4],
                "updated_at": r[5],
                "summary": r[6],
                "status": r[7],
                "subject_person_id": _as_str(r[8]),
            }
            for r in rows
        ]
    except Exception as e:
        print("Error retrieving stories:", e)
        return []


def get_all_stories_limited(limit: int = 100, vault_id: str = DEFAULT_VAULT_ID) -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.id, COALESCE(p.display_name, s.title), s.summary, s.created_at
                    FROM stories s
                    LEFT JOIN persons p ON p.id = s.subject_person_id
                    WHERE s.vault_id = %s
                    ORDER BY s.created_at DESC LIMIT %s
                    """,
                    (vault_id, limit),
                )
                return [
                    {
                        "id": str(row[0]),
                        "person_name": row[1],
                        "summary": row[2],
                        "created_at": row[3],
                    }
                    for row in cur.fetchall()
                ]
    except Exception as e:
        print(f"Error retrieving stories: {e}")
        return []


def delete_story(story_id: str) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM stories WHERE id = %s", (story_id,))
                return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting story: {e}")
        return False


def update_story(
    story_id: str,
    person_name: Optional[str] = None,
    raw_body: Optional[str] = None,
    story: Optional[str] = None,
    summary: Optional[str] = None,
) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                updates = []
                values: List[Any] = []
                if raw_body is not None:
                    updates.append("transcript = %s")
                    values.append(raw_body)
                if story is not None:
                    updates.append("biography = %s")
                    values.append(story)
                if summary is not None:
                    updates.append("summary = %s")
                    values.append(summary)
                if person_name is not None:
                    updates.append("title = %s")
                    values.append(person_name)
                if not updates:
                    return False
                values.append(story_id)
                cur.execute(
                    f"UPDATE stories SET {', '.join(updates)} WHERE id = %s",
                    values,
                )
                if person_name is not None:
                    cur.execute(
                        """
                        UPDATE persons SET display_name = %s
                        WHERE id = (SELECT subject_person_id FROM stories WHERE id = %s)
                        """,
                        (person_name, story_id),
                    )
                return cur.rowcount >= 0
    except Exception as e:
        print("Error updating story:", e)
        return False


# ---------------------------------------------------------------------------
# People / timelines
# ---------------------------------------------------------------------------
def get_all_people(vault_id: str = DEFAULT_VAULT_ID) -> List[Dict]:
    """Persons with timeline event counts (for timeline home)."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT p.id,
                           p.display_name,
                           COUNT(te.id) FILTER (WHERE te.status = 'confirmed') AS event_count,
                           p.updated_at,
                           (
                             SELECT s.id FROM stories s
                             WHERE s.subject_person_id = p.id
                             ORDER BY s.updated_at DESC LIMIT 1
                           ) AS latest_story_id
                    FROM persons p
                    LEFT JOIN timeline_events te ON te.person_id = p.id
                    WHERE p.vault_id = %s
                    GROUP BY p.id, p.display_name, p.updated_at
                    ORDER BY p.updated_at DESC
                    """,
                    (vault_id,),
                )
                rows = cur.fetchall()
        return [
            {
                # Compat: timeline UI used story_id as navigation key
                "person_id": str(r[0]),
                "story_id": _as_str(r[4]) or str(r[0]),
                "person_name": r[1] or "Unknown",
                "event_count": r[2] or 0,
                "updated_at": r[3],
            }
            for r in rows
        ]
    except Exception as e:
        print(f"Error retrieving people: {e}")
        return []


def _fetch_timeline_for_person(
    cur, person_id: str, confirmed_only: bool = True
) -> List[Dict]:
    clause = "AND status = 'confirmed'" if confirmed_only else ""
    cur.execute(
        f"""
        SELECT id, year, title, description, place, category, created_at,
               source_story_id, status, confidence
        FROM timeline_events
        WHERE person_id = %s {clause}
        ORDER BY year NULLS LAST, created_at
        """,
        (person_id,),
    )
    return [
        {
            "id": str(row[0]),
            "year": row[1],
            "event": row[2],
            "title": row[2],
            "description": row[3],
            "location": row[4],
            "place": row[4],
            "category": row[5],
            "created_at": row[6],
            "source_story_id": _as_str(row[7]),
            "status": row[8],
            "confidence": row[9],
        }
        for row in cur.fetchall()
    ]


def _fetch_occupations(cur, person_id: str) -> List[Dict]:
    cur.execute(
        """
        SELECT id, role, start_year, end_year, location, created_at
        FROM occupations WHERE person_id = %s AND status = 'confirmed'
        ORDER BY start_year NULLS LAST
        """,
        (person_id,),
    )
    return [
        {
            "id": str(r[0]),
            "role": r[1],
            "start_year": r[2],
            "end_year": r[3],
            "location": r[4],
            "created_at": r[5],
        }
        for r in cur.fetchall()
    ]


def _fetch_places(cur, person_id: str) -> List[Dict]:
    cur.execute(
        """
        SELECT id, place, start_year, end_year, purpose, created_at
        FROM places WHERE person_id = %s AND status = 'confirmed'
        ORDER BY start_year NULLS LAST
        """,
        (person_id,),
    )
    return [
        {
            "id": str(r[0]),
            "place": r[1],
            "start_year": r[2],
            "end_year": r[3],
            "purpose": r[4],
            "created_at": r[5],
        }
        for r in cur.fetchall()
    ]


def get_timeline_events(story_or_person_id: str) -> Dict:
    """
    Resolve timeline by story id (subject person) OR person id.
    Returns { person_name, person_id, events }.
    """
    empty: Dict = {"person_name": None, "person_id": None, "events": []}
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.subject_person_id, p.display_name
                    FROM stories s
                    LEFT JOIN persons p ON p.id = s.subject_person_id
                    WHERE s.id = %s
                    """,
                    (story_or_person_id,),
                )
                row = cur.fetchone()
                if row and row[0]:
                    pid = str(row[0])
                    return {
                        "person_name": row[1],
                        "person_id": pid,
                        "events": _fetch_timeline_for_person(cur, pid),
                    }

                cur.execute(
                    "SELECT id, display_name FROM persons WHERE id = %s",
                    (story_or_person_id,),
                )
                person = cur.fetchone()
                if person:
                    pid = str(person[0])
                    return {
                        "person_name": person[1],
                        "person_id": pid,
                        "events": _fetch_timeline_for_person(cur, pid),
                    }
                return empty
    except Exception as e:
        print(f"Error retrieving timeline events: {e}")
        return empty


def get_master_timeline(
    vault_id: str = DEFAULT_VAULT_ID,
    person_ids: Optional[List[str]] = None,
) -> List[Dict]:
    """All confirmed events in a vault (optional person filter)."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if person_ids:
                    cur.execute(
                        """
                        SELECT te.id, te.year, te.title, te.description, te.place,
                               te.category, te.person_id, p.display_name,
                               te.source_story_id, te.created_at
                        FROM timeline_events te
                        JOIN persons p ON p.id = te.person_id
                        WHERE te.vault_id = %s AND te.status = 'confirmed'
                          AND te.person_id = ANY(%s::uuid[])
                        ORDER BY te.year NULLS LAST, te.created_at
                        """,
                        (vault_id, person_ids),
                    )
                else:
                    cur.execute(
                        """
                        SELECT te.id, te.year, te.title, te.description, te.place,
                               te.category, te.person_id, p.display_name,
                               te.source_story_id, te.created_at
                        FROM timeline_events te
                        JOIN persons p ON p.id = te.person_id
                        WHERE te.vault_id = %s AND te.status = 'confirmed'
                        ORDER BY te.year NULLS LAST, te.created_at
                        """,
                        (vault_id,),
                    )
                return [
                    {
                        "id": str(r[0]),
                        "year": r[1],
                        "event": r[2],
                        "title": r[2],
                        "description": r[3],
                        "location": r[4],
                        "category": r[5],
                        "person_id": str(r[6]),
                        "person_name": r[7],
                        "source_story_id": _as_str(r[8]),
                        "created_at": r[9],
                    }
                    for r in cur.fetchall()
                ]
    except Exception as e:
        print(f"Error retrieving master timeline: {e}")
        return []


# ---------------------------------------------------------------------------
# Family tree: persons + relationships
# ---------------------------------------------------------------------------
def get_family_graph(
    vault_id: str = DEFAULT_VAULT_ID,
    viewpoint_person_id: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT kinship_system, cultural_context, name
                    FROM family_vaults WHERE id = %s
                    """,
                    (vault_id,),
                )
                vault_row = cur.fetchone()
                kinship_system = (vault_row[0] if vault_row else None) or "punjabi"
                cultural_context = (vault_row[1] if vault_row else None) or "punjabi"
                vault_name = vault_row[2] if vault_row else "Family Vault"

                cur.execute(
                    """
                    SELECT id, display_name, birth_year, death_year, notes,
                           birth_place, sex
                    FROM persons WHERE vault_id = %s ORDER BY display_name
                    """,
                    (vault_id,),
                )
                persons = [
                    {
                        "id": str(r[0]),
                        "name": r[1],
                        "birth_year": r[2],
                        "death_year": r[3],
                        "notes": r[4],
                        "birth_place": r[5],
                        "sex": r[6],
                        "relationship": None,
                        "story_id": None,
                        "kinship_label": None,
                    }
                    for r in cur.fetchall()
                ]
                cur.execute(
                    """
                    SELECT id, from_person_id, to_person_id, type, certainty,
                           source_story_id, notes, cultural_label
                    FROM relationships WHERE vault_id = %s
                    """,
                    (vault_id,),
                )
                relationships = [
                    {
                        "id": str(r[0]),
                        "from_person_id": str(r[1]),
                        "to_person_id": str(r[2]),
                        "type": r[3],
                        "certainty": r[4],
                        "source_story_id": _as_str(r[5]),
                        "notes": r[6],
                        "cultural_label": r[7],
                    }
                    for r in cur.fetchall()
                ]

        # Cultural kinship labels from viewpoint (default: first person or subject)
        ego = viewpoint_person_id or (persons[0]["id"] if persons else None)
        if ego:
            try:
                from kinship import label_all_relatives

                edges = [
                    (r["from_person_id"], r["to_person_id"], r["type"])
                    for r in relationships
                ]
                sex_by_id = {
                    p["id"]: (p["sex"] or "").lower() or None
                    for p in persons
                    if p.get("sex")
                }
                # normalize sex hints
                sex_norm = {}
                for pid, s in sex_by_id.items():
                    if not s:
                        continue
                    if s in ("m", "male", "man"):
                        sex_norm[pid] = "male"
                    elif s in ("f", "female", "woman"):
                        sex_norm[pid] = "female"

                labels = label_all_relatives(
                    kinship_system,
                    ego,
                    [p["id"] for p in persons],
                    edges,
                    sex_norm,
                )
                for p in persons:
                    p["kinship_label"] = labels.get(p["id"])
                    if p["id"] != ego:
                        p["relationship"] = p["kinship_label"]
            except Exception as ke:
                print("Kinship labeling skipped:", ke)

        return {
            "vault": {
                "id": vault_id,
                "name": vault_name,
                "kinship_system": kinship_system,
                "cultural_context": cultural_context,
            },
            "viewpoint_person_id": ego,
            "persons": persons,
            "relationships": relationships,
            "members": persons,
        }
    except Exception as e:
        print("Error get_family_graph:", e)
        return {
            "vault": None,
            "viewpoint_person_id": None,
            "persons": [],
            "relationships": [],
            "members": [],
        }


def get_all_family_members(vault_id: str = DEFAULT_VAULT_ID) -> List[Dict]:
    """Back-compat list of persons for older clients."""
    return get_family_graph(vault_id)["persons"]


def create_person(
    name: str,
    vault_id: str = DEFAULT_VAULT_ID,
    birth_year: Optional[int] = None,
    death_year: Optional[int] = None,
    notes: Optional[str] = None,
    birth_place: Optional[str] = None,
) -> Optional[str]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                ensure_default_vault(cur)
                return get_or_create_person_by_name(
                    cur, vault_id, name, birth_year, death_year, birth_place, notes
                )
    except Exception as e:
        print("Error create_person:", e)
        return None


def create_family_member_global(
    name: str,
    relationship: str = "relative",
    story_id: Optional[str] = None,
    birth_year: Optional[int] = None,
    death_year: Optional[int] = None,
    notes: Optional[str] = None,
    vault_id: str = DEFAULT_VAULT_ID,
    related_to_person_id: Optional[str] = None,
) -> Optional[str]:
    """
    Create a person and optionally link them to a subject
    (story subject or related_to_person_id).
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                ensure_default_vault(cur)
                person_id = get_or_create_person_by_name(
                    cur, vault_id, name, birth_year, death_year, notes=notes
                )
                subject_id = related_to_person_id
                if not subject_id and story_id:
                    cur.execute(
                        "SELECT subject_person_id FROM stories WHERE id = %s",
                        (story_id,),
                    )
                    row = cur.fetchone()
                    subject_id = str(row[0]) if row and row[0] else None
                if subject_id:
                    frm, to, rel_type = _edge_for_label(
                        subject_id, person_id, relationship
                    )
                    _insert_relationship(
                        cur, vault_id, frm, to, rel_type, story_id, certainty=1.0
                    )
                return person_id
    except Exception as e:
        print("Error create_family_member_global:", e)
        return None


def update_person(
    person_id: str,
    name: Optional[str] = None,
    birth_year: Optional[int] = None,
    death_year: Optional[int] = None,
    notes: Optional[str] = None,
    birth_place: Optional[str] = None,
) -> bool:
    try:
        updates = []
        vals: List[Any] = []
        if name is not None:
            updates.append("display_name = %s")
            vals.append(name)
        if birth_year is not None:
            updates.append("birth_year = %s")
            vals.append(birth_year)
        if death_year is not None:
            updates.append("death_year = %s")
            vals.append(death_year)
        if notes is not None:
            updates.append("notes = %s")
            vals.append(notes)
        if birth_place is not None:
            updates.append("birth_place = %s")
            vals.append(birth_place)
        if not updates:
            return False
        vals.append(person_id)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE persons SET {', '.join(updates)} WHERE id = %s",
                    tuple(vals),
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error update_person:", e)
        return False


# Back-compat alias
def update_family_member(
    member_id: str,
    name: Optional[str] = None,
    relationship: Optional[str] = None,
    birth_year: Optional[int] = None,
    death_year: Optional[int] = None,
    notes: Optional[str] = None,
) -> bool:
    # relationship string updates are ignored here; use create_relationship
    return update_person(member_id, name, birth_year, death_year, notes)


def delete_person(person_id: str) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM persons WHERE id = %s", (person_id,))
                return cur.rowcount > 0
    except Exception as e:
        print("Error delete_person:", e)
        return False


def delete_family_member(member_id: str) -> bool:
    return delete_person(member_id)


def create_relationship(
    from_person_id: str,
    to_person_id: str,
    rel_type: str = "relative",
    vault_id: str = DEFAULT_VAULT_ID,
    source_story_id: Optional[str] = None,
    certainty: float = 1.0,
    notes: Optional[str] = None,
) -> Optional[str]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                ensure_default_vault(cur)
                rel_id = _insert_relationship(
                    cur,
                    vault_id,
                    from_person_id,
                    to_person_id,
                    normalize_relationship_type(rel_type),
                    source_story_id,
                    certainty,
                )
                if notes and rel_id:
                    cur.execute(
                        "UPDATE relationships SET notes = %s WHERE id = %s",
                        (notes, rel_id),
                    )
                return rel_id
    except Exception as e:
        print("Error create_relationship:", e)
        return None


def delete_relationship(relationship_id: str) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM relationships WHERE id = %s", (relationship_id,)
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error delete_relationship:", e)
        return False


# ---------------------------------------------------------------------------
# AI suggestions
# ---------------------------------------------------------------------------
def list_suggestions(
    story_id: Optional[str] = None,
    status: str = "pending",
    vault_id: str = DEFAULT_VAULT_ID,
) -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if story_id:
                    cur.execute(
                        """
                        SELECT id, story_id, kind, payload, status, resolved_entity_id, created_at
                        FROM ai_suggestions
                        WHERE vault_id = %s AND story_id = %s AND status = %s::suggestion_status
                        ORDER BY created_at
                        """,
                        (vault_id, story_id, status),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, story_id, kind, payload, status, resolved_entity_id, created_at
                        FROM ai_suggestions
                        WHERE vault_id = %s AND status = %s::suggestion_status
                        ORDER BY created_at
                        """,
                        (vault_id, status),
                    )
                return [
                    {
                        "id": str(r[0]),
                        "story_id": str(r[1]),
                        "kind": r[2],
                        "payload": _loads(r[3]),
                        "status": r[4],
                        "resolved_entity_id": _as_str(r[5]),
                        "created_at": r[6],
                    }
                    for r in cur.fetchall()
                ]
    except Exception as e:
        print("Error list_suggestions:", e)
        return []


def reject_suggestion(suggestion_id: str) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ai_suggestions
                    SET status = 'rejected', resolved_at = NOW()
                    WHERE id = %s
                    """,
                    (suggestion_id,),
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error reject_suggestion:", e)
        return False


# ---------------------------------------------------------------------------
# Media / jobs helpers (for upcoming upload pipeline)
# ---------------------------------------------------------------------------
def create_story_shell(
    vault_id: str = DEFAULT_VAULT_ID,
    title: Optional[str] = None,
    subject_person_id: Optional[str] = None,
    contributor_id: Optional[str] = None,
) -> Optional[str]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                ensure_default_vault(cur)
                cur.execute(
                    """
                    INSERT INTO stories (
                        vault_id, subject_person_id, contributor_id, title, status
                    ) VALUES (%s, %s, %s, %s, 'uploading')
                    RETURNING id
                    """,
                    (vault_id, subject_person_id, contributor_id, title or "New recording"),
                )
                return str(cur.fetchone()[0])
    except Exception as e:
        print("Error create_story_shell:", e)
        return None


def add_media_asset(
    story_id: str,
    storage_path: str,
    mime_type: Optional[str] = None,
    byte_size: Optional[int] = None,
    duration_sec: Optional[float] = None,
    bucket: Optional[str] = None,
) -> Optional[str]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO media_assets (
                        story_id, storage_path, bucket, mime_type, byte_size, duration_sec
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (story_id, storage_path, bucket, mime_type, byte_size, duration_sec),
                )
                return str(cur.fetchone()[0])
    except Exception as e:
        print("Error add_media_asset:", e)
        return None


def create_processing_job(story_id: str) -> Optional[str]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO processing_jobs (story_id, stage, progress, started_at)
                    VALUES (%s, 'queued', 0, NOW())
                    RETURNING id
                    """,
                    (story_id,),
                )
                return str(cur.fetchone()[0])
    except Exception as e:
        print("Error create_processing_job:", e)
        return None


def update_processing_job(
    job_id: str,
    stage: Optional[str] = None,
    progress: Optional[float] = None,
    error: Optional[str] = None,
) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                updates = []
                vals: List[Any] = []
                if stage is not None:
                    updates.append("stage = %s::job_stage")
                    vals.append(stage)
                    if stage in ("completed", "failed"):
                        updates.append("finished_at = NOW()")
                if progress is not None:
                    updates.append("progress = %s")
                    vals.append(progress)
                if error is not None:
                    updates.append("error = %s")
                    vals.append(error)
                if not updates:
                    return False
                vals.append(job_id)
                cur.execute(
                    f"UPDATE processing_jobs SET {', '.join(updates)} WHERE id = %s",
                    vals,
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error update_processing_job:", e)
        return False


def mark_story_failed(story_id: str, error_message: str) -> bool:
    """Set story status to failed and store the error message."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE stories
                    SET status = 'failed'::story_status,
                        error_message = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (error_message, story_id),
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error mark_story_failed:", e)
        return False


def set_story_status(story_id: str, status: str) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE stories SET status = %s::story_status
                    WHERE id = %s
                    """,
                    (status, story_id),
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error set_story_status:", e)
        return False


def get_processing_status(story_id: str) -> Optional[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.id, s.status, s.error_message, s.title, s.subject_person_id,
                           j.id, j.stage, j.progress, j.error, j.updated_at
                    FROM stories s
                    LEFT JOIN LATERAL (
                        SELECT * FROM processing_jobs
                        WHERE story_id = s.id
                        ORDER BY created_at DESC LIMIT 1
                    ) j ON true
                    WHERE s.id = %s
                    """,
                    (story_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    "story_id": str(row[0]),
                    "status": row[1],
                    "error_message": row[2],
                    "title": row[3],
                    "subject_person_id": _as_str(row[4]),
                    "job_id": _as_str(row[5]),
                    "stage": row[6],
                    "progress": float(row[7] or 0),
                    "job_error": row[8],
                    "updated_at": row[9],
                }
    except Exception as e:
        print("Error get_processing_status:", e)
        return None


def _apply_extracted_to_graph(
    cur,
    vault_id: str,
    story_id: str,
    subject_id: str,
    extracted_data: Dict,
    auto_confirm: bool,
) -> None:
    fact_status = "confirmed" if auto_confirm else "suggested"
    suggestion_status = "accepted" if auto_confirm else "pending"

    for event in (extracted_data or {}).get("timeline_events") or []:
        title = event.get("event") or event.get("title") or "Event"
        cur.execute(
            """
            INSERT INTO timeline_events (
                vault_id, person_id, source_story_id, year, title,
                description, place, category, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::fact_status)
            RETURNING id
            """,
            (
                vault_id,
                subject_id,
                story_id,
                event.get("year"),
                title,
                event.get("description"),
                event.get("location") or event.get("place"),
                event.get("category"),
                fact_status,
            ),
        )
        event_id = str(cur.fetchone()[0])
        cur.execute(
            """
            INSERT INTO ai_suggestions (
                vault_id, story_id, kind, payload, status, resolved_entity_id
            ) VALUES (%s, %s, 'timeline_event', %s::jsonb, %s::suggestion_status, %s)
            """,
            (
                vault_id,
                story_id,
                _json(event),
                suggestion_status,
                event_id if auto_confirm else None,
            ),
        )

    for member in (extracted_data or {}).get("family_members") or []:
        m_name = member.get("name") or "Unknown relative"
        other_id = get_or_create_person_by_name(
            cur,
            vault_id,
            m_name,
            birth_year=member.get("birth_year"),
            death_year=member.get("death_year"),
            notes=member.get("notes"),
        )
        frm, to, rel_type = _edge_for_label(
            subject_id, other_id, member.get("relationship") or "relative"
        )
        rel_id = _insert_relationship(
            cur, vault_id, frm, to, rel_type, story_id, certainty=0.75
        )
        cur.execute(
            """
            INSERT INTO ai_suggestions (
                vault_id, story_id, kind, payload, status, resolved_entity_id
            ) VALUES (%s, %s, 'relationship', %s::jsonb, %s::suggestion_status, %s)
            """,
            (
                vault_id,
                story_id,
                _json({**member, "person_id": other_id, "relationship_id": rel_id}),
                suggestion_status,
                rel_id if auto_confirm else None,
            ),
        )

    for location in (extracted_data or {}).get("locations") or []:
        cur.execute(
            """
            INSERT INTO places (
                vault_id, person_id, source_story_id, place,
                start_year, end_year, purpose, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::fact_status)
            RETURNING id
            """,
            (
                vault_id,
                subject_id,
                story_id,
                location.get("place"),
                location.get("start_year"),
                location.get("end_year"),
                location.get("purpose"),
                fact_status,
            ),
        )
        place_id = str(cur.fetchone()[0])
        cur.execute(
            """
            INSERT INTO ai_suggestions (
                vault_id, story_id, kind, payload, status, resolved_entity_id
            ) VALUES (%s, %s, 'place', %s::jsonb, %s::suggestion_status, %s)
            """,
            (
                vault_id,
                story_id,
                _json(location),
                suggestion_status,
                place_id if auto_confirm else None,
            ),
        )

    for occupation in (extracted_data or {}).get("occupations") or []:
        cur.execute(
            """
            INSERT INTO occupations (
                vault_id, person_id, source_story_id, role,
                start_year, end_year, location, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::fact_status)
            RETURNING id
            """,
            (
                vault_id,
                subject_id,
                story_id,
                occupation.get("role"),
                occupation.get("start_year"),
                occupation.get("end_year"),
                occupation.get("location"),
                fact_status,
            ),
        )
        occ_id = str(cur.fetchone()[0])
        cur.execute(
            """
            INSERT INTO ai_suggestions (
                vault_id, story_id, kind, payload, status, resolved_entity_id
            ) VALUES (%s, %s, 'occupation', %s::jsonb, %s::suggestion_status, %s)
            """,
            (
                vault_id,
                story_id,
                _json(occupation),
                suggestion_status,
                occ_id if auto_confirm else None,
            ),
        )

    for theme_name in (extracted_data or {}).get("themes") or []:
        if not theme_name:
            continue
        cur.execute(
            "INSERT INTO themes (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
            (theme_name,),
        )
        theme_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO story_themes (story_id, theme_id)
            VALUES (%s, %s) ON CONFLICT DO NOTHING
            """,
            (story_id, theme_id),
        )


def finalize_story_processing(
    story_id: str,
    transcript: str,
    biography: str,
    summary: Optional[str],
    extracted_data: Dict,
    person_name_hint: Optional[str] = None,
    auto_confirm: bool = True,
) -> bool:
    """
    Persist pipeline outputs onto an existing story shell and write
    timeline events + family relationships into the vault graph.
    """
    vault_id: Optional[str] = None
    ok = False
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT vault_id, subject_person_id FROM stories WHERE id = %s",
                    (story_id,),
                )
                row = cur.fetchone()
                if not row:
                    return False
                vault_id = str(row[0])
                existing_subject = _as_str(row[1])

                person_info = (extracted_data or {}).get("person_info") or {}
                display = (
                    person_name_hint
                    or person_info.get("name")
                    or "Unknown"
                )

                subject_id = existing_subject or get_or_create_person_by_name(
                    cur,
                    vault_id,
                    display,
                    birth_year=person_info.get("birth_year"),
                    death_year=person_info.get("death_year"),
                    birth_place=person_info.get("birth_place"),
                )
                if existing_subject and person_name_hint:
                    cur.execute(
                        """
                        UPDATE persons SET
                            display_name = COALESCE(%s, display_name),
                            birth_year = COALESCE(%s, birth_year),
                            death_year = COALESCE(%s, death_year),
                            birth_place = COALESCE(%s, birth_place)
                        WHERE id = %s
                        """,
                        (
                            display if display != "Unknown" else None,
                            person_info.get("birth_year"),
                            person_info.get("death_year"),
                            person_info.get("birth_place"),
                            subject_id,
                        ),
                    )
                elif not existing_subject:
                    cur.execute(
                        "UPDATE persons SET display_name = %s WHERE id = %s",
                        (display, subject_id),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE persons SET
                            birth_year = COALESCE(%s, birth_year),
                            death_year = COALESCE(%s, death_year),
                            birth_place = COALESCE(%s, birth_place)
                        WHERE id = %s
                        """,
                        (
                            person_info.get("birth_year"),
                            person_info.get("death_year"),
                            person_info.get("birth_place"),
                            subject_id,
                        ),
                    )

                cur.execute(
                    """
                    UPDATE stories
                    SET transcript = %s,
                        biography = %s,
                        summary = %s,
                        extracted_data = %s::jsonb,
                        subject_person_id = %s,
                        title = %s,
                        status = 'ready'::story_status,
                        error_message = NULL,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        transcript,
                        biography,
                        summary,
                        _json(extracted_data),
                        subject_id,
                        display,
                        story_id,
                    ),
                )

                _apply_extracted_to_graph(
                    cur, vault_id, story_id, subject_id, extracted_data or {}, auto_confirm
                )
                ok = True
    except Exception as e:
        print("Error finalize_story_processing:", e)
        import traceback

        traceback.print_exc()
        return False

    if ok and vault_id:
        try:
            link_shared_memories_for_vault(vault_id)
        except Exception as le:
            print("Shared memory linking skipped:", le)
    return ok


# ---------------------------------------------------------------------------
# Living platform: vault culture, artifacts, archive search, shared memories
# ---------------------------------------------------------------------------
def get_vault(vault_id: str = DEFAULT_VAULT_ID) -> Optional[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, description, cultural_context,
                           primary_language, kinship_system, created_at
                    FROM family_vaults WHERE id = %s
                    """,
                    (vault_id,),
                )
                r = cur.fetchone()
                if not r:
                    return None
                return {
                    "id": str(r[0]),
                    "name": r[1],
                    "description": r[2],
                    "cultural_context": r[3],
                    "primary_language": r[4],
                    "kinship_system": r[5],
                    "created_at": r[6],
                }
    except Exception as e:
        print("Error get_vault:", e)
        return None


def update_vault_culture(
    vault_id: str,
    cultural_context: Optional[str] = None,
    kinship_system: Optional[str] = None,
    primary_language: Optional[str] = None,
    name: Optional[str] = None,
) -> bool:
    try:
        updates = []
        vals: List[Any] = []
        if cultural_context is not None:
            updates.append("cultural_context = %s")
            vals.append(cultural_context)
        if kinship_system is not None:
            updates.append("kinship_system = %s")
            vals.append(kinship_system)
        if primary_language is not None:
            updates.append("primary_language = %s")
            vals.append(primary_language)
        if name is not None:
            updates.append("name = %s")
            vals.append(name)
        if not updates:
            return False
        vals.append(vault_id)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE family_vaults SET {', '.join(updates)} WHERE id = %s",
                    vals,
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error update_vault_culture:", e)
        return False


def create_artifact(
    title: str,
    storage_path: str,
    artifact_type: str = "other",
    vault_id: str = DEFAULT_VAULT_ID,
    caption: Optional[str] = None,
    mime_type: Optional[str] = None,
    byte_size: Optional[int] = None,
    person_id: Optional[str] = None,
    story_id: Optional[str] = None,
    taken_year: Optional[int] = None,
    taken_place: Optional[str] = None,
    shared_memory_id: Optional[str] = None,
) -> Optional[str]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO artifacts (
                        vault_id, artifact_type, title, caption, storage_path,
                        mime_type, byte_size, person_id, story_id,
                        taken_year, taken_place, shared_memory_id
                    ) VALUES (
                        %s, %s::artifact_type, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id
                    """,
                    (
                        vault_id,
                        artifact_type,
                        title,
                        caption,
                        storage_path,
                        mime_type,
                        byte_size,
                        person_id,
                        story_id,
                        taken_year,
                        taken_place,
                        shared_memory_id,
                    ),
                )
                return str(cur.fetchone()[0])
    except Exception as e:
        print("Error create_artifact:", e)
        return None


def list_artifacts(
    vault_id: str = DEFAULT_VAULT_ID,
    person_id: Optional[str] = None,
    artifact_type: Optional[str] = None,
) -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                clauses = ["vault_id = %s"]
                vals: List[Any] = [vault_id]
                if person_id:
                    clauses.append("person_id = %s")
                    vals.append(person_id)
                if artifact_type:
                    clauses.append("artifact_type = %s::artifact_type")
                    vals.append(artifact_type)
                cur.execute(
                    f"""
                    SELECT id, artifact_type, title, caption, storage_path,
                           mime_type, person_id, story_id, taken_year, taken_place,
                           shared_memory_id, created_at
                    FROM artifacts
                    WHERE {' AND '.join(clauses)}
                    ORDER BY created_at DESC
                    """,
                    vals,
                )
                return [
                    {
                        "id": str(r[0]),
                        "artifact_type": r[1],
                        "title": r[2],
                        "caption": r[3],
                        "storage_path": r[4],
                        "mime_type": r[5],
                        "person_id": _as_str(r[6]),
                        "story_id": _as_str(r[7]),
                        "taken_year": r[8],
                        "taken_place": r[9],
                        "shared_memory_id": _as_str(r[10]),
                        "created_at": r[11],
                    }
                    for r in cur.fetchall()
                ]
    except Exception as e:
        print("Error list_artifacts:", e)
        return []


def search_archive(query: str, vault_id: str = DEFAULT_VAULT_ID, limit: int = 40) -> Dict[str, List]:
    """Full-text + ILIKE fallback across stories, people, events, artifacts."""
    q = (query or "").strip()
    if not q:
        return {"stories": [], "persons": [], "events": [], "artifacts": [], "shared_memories": []}

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, summary, status,
                           ts_rank(search_vector, plainto_tsquery('english', %s)) AS rank
                    FROM stories
                    WHERE vault_id = %s
                      AND (
                        search_vector @@ plainto_tsquery('english', %s)
                        OR title ILIKE %s OR summary ILIKE %s OR biography ILIKE %s
                      )
                    ORDER BY rank DESC NULLS LAST, updated_at DESC
                    LIMIT %s
                    """,
                    (q, vault_id, q, f"%{q}%", f"%{q}%", f"%{q}%", limit),
                )
                stories = [
                    {
                        "id": str(r[0]),
                        "title": r[1],
                        "summary": r[2],
                        "status": r[3],
                        "rank": float(r[4] or 0),
                        "kind": "story",
                    }
                    for r in cur.fetchall()
                ]

                cur.execute(
                    """
                    SELECT id, display_name, birth_year, birth_place, notes
                    FROM persons
                    WHERE vault_id = %s
                      AND (
                        search_vector @@ plainto_tsquery('english', %s)
                        OR display_name ILIKE %s OR notes ILIKE %s OR birth_place ILIKE %s
                      )
                    ORDER BY display_name
                    LIMIT %s
                    """,
                    (vault_id, q, f"%{q}%", f"%{q}%", f"%{q}%", limit),
                )
                persons = [
                    {
                        "id": str(r[0]),
                        "name": r[1],
                        "birth_year": r[2],
                        "birth_place": r[3],
                        "notes": r[4],
                        "kind": "person",
                    }
                    for r in cur.fetchall()
                ]

                cur.execute(
                    """
                    SELECT te.id, te.year, te.title, te.description, te.place,
                           te.person_id, p.display_name, te.shared_memory_id
                    FROM timeline_events te
                    JOIN persons p ON p.id = te.person_id
                    WHERE te.vault_id = %s AND te.status = 'confirmed'
                      AND (
                        te.title ILIKE %s OR te.description ILIKE %s
                        OR te.place ILIKE %s OR CAST(te.year AS TEXT) = %s
                      )
                    ORDER BY te.year NULLS LAST
                    LIMIT %s
                    """,
                    (vault_id, f"%{q}%", f"%{q}%", f"%{q}%", q, limit),
                )
                events = [
                    {
                        "id": str(r[0]),
                        "year": r[1],
                        "title": r[2],
                        "description": r[3],
                        "place": r[4],
                        "person_id": str(r[5]),
                        "person_name": r[6],
                        "shared_memory_id": _as_str(r[7]),
                        "kind": "event",
                    }
                    for r in cur.fetchall()
                ]

                cur.execute(
                    """
                    SELECT id, artifact_type, title, caption, taken_year, taken_place
                    FROM artifacts
                    WHERE vault_id = %s
                      AND (title ILIKE %s OR caption ILIKE %s OR taken_place ILIKE %s)
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (vault_id, f"%{q}%", f"%{q}%", f"%{q}%", limit),
                )
                artifacts = [
                    {
                        "id": str(r[0]),
                        "artifact_type": r[1],
                        "title": r[2],
                        "caption": r[3],
                        "taken_year": r[4],
                        "taken_place": r[5],
                        "kind": "artifact",
                    }
                    for r in cur.fetchall()
                ]

                cur.execute(
                    """
                    SELECT id, title, year, place, description
                    FROM shared_memories
                    WHERE vault_id = %s
                      AND (title ILIKE %s OR description ILIKE %s OR place ILIKE %s)
                    ORDER BY year NULLS LAST
                    LIMIT %s
                    """,
                    (vault_id, f"%{q}%", f"%{q}%", f"%{q}%", limit),
                )
                shared = [
                    {
                        "id": str(r[0]),
                        "title": r[1],
                        "year": r[2],
                        "place": r[3],
                        "description": r[4],
                        "kind": "shared_memory",
                    }
                    for r in cur.fetchall()
                ]

        return {
            "query": q,
            "stories": stories,
            "persons": persons,
            "events": events,
            "artifacts": artifacts,
            "shared_memories": shared,
        }
    except Exception as e:
        print("Error search_archive:", e)
        return {
            "query": q,
            "stories": [],
            "persons": [],
            "events": [],
            "artifacts": [],
            "shared_memories": [],
        }


def link_shared_memories_for_vault(vault_id: str = DEFAULT_VAULT_ID) -> int:
    """
    Cluster confirmed timeline events into shared_memories when they look like
    the same real-world moment told from different stories/people.
    Returns number of multi-perspective memories created/updated.
    """
    from shared_memory import cluster_events, cluster_title

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, year, title, description, place, category,
                           person_id, source_story_id, shared_memory_id
                    FROM timeline_events
                    WHERE vault_id = %s AND status = 'confirmed'
                    ORDER BY year NULLS LAST, created_at
                    """,
                    (vault_id,),
                )
                events = [
                    {
                        "id": str(r[0]),
                        "year": r[1],
                        "title": r[2],
                        "event": r[2],
                        "description": r[3],
                        "place": r[4],
                        "location": r[4],
                        "category": r[5],
                        "person_id": _as_str(r[6]),
                        "source_story_id": _as_str(r[7]),
                        "shared_memory_id": _as_str(r[8]),
                    }
                    for r in cur.fetchall()
                ]

                clusters = cluster_events(events, threshold=0.55)
                created = 0

                for group in clusters:
                    story_ids = {e.get("source_story_id") for e in group if e.get("source_story_id")}
                    person_ids = {e.get("person_id") for e in group if e.get("person_id")}
                    if len(group) < 2 or (len(story_ids) < 2 and len(person_ids) < 2):
                        continue

                    existing = next(
                        (e.get("shared_memory_id") for e in group if e.get("shared_memory_id")),
                        None,
                    )
                    title = cluster_title(group)
                    year = next((e.get("year") for e in group if e.get("year")), None)
                    place = next((e.get("place") for e in group if e.get("place")), None)
                    category = next((e.get("category") for e in group if e.get("category")), None)
                    desc = " · ".join(
                        sorted(
                            {
                                (e.get("description") or e.get("title") or "").strip()
                                for e in group
                                if (e.get("description") or e.get("title"))
                            }
                        )
                    )[:2000]

                    if existing:
                        memory_id = existing
                        cur.execute(
                            """
                            UPDATE shared_memories
                            SET title = %s, year = COALESCE(%s, year),
                                place = COALESCE(%s, place),
                                description = %s, category = COALESCE(%s, category)
                            WHERE id = %s
                            """,
                            (title, year, place, desc, category, memory_id),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO shared_memories (
                                vault_id, title, year, place, description, category
                            ) VALUES (%s, %s, %s, %s, %s, %s)
                            RETURNING id
                            """,
                            (vault_id, title, year, place, desc, category),
                        )
                        memory_id = str(cur.fetchone()[0])
                        created += 1

                    for e in group:
                        cur.execute(
                            """
                            UPDATE timeline_events
                            SET shared_memory_id = %s
                            WHERE id = %s
                            """,
                            (memory_id, e["id"]),
                        )
                        cur.execute(
                            """
                            INSERT INTO memory_perspectives (
                                shared_memory_id, timeline_event_id, person_id, story_id,
                                perspective_summary
                            ) VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (shared_memory_id, timeline_event_id) DO NOTHING
                            """,
                            (
                                memory_id,
                                e["id"],
                                e.get("person_id"),
                                e.get("source_story_id"),
                                e.get("description") or e.get("title"),
                            ),
                        )

                return created
    except Exception as e:
        print("Error link_shared_memories_for_vault:", e)
        import traceback

        traceback.print_exc()
        return 0


def list_shared_memories(vault_id: str = DEFAULT_VAULT_ID) -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT sm.id, sm.title, sm.year, sm.place, sm.description, sm.category,
                           sm.confidence,
                           COUNT(DISTINCT mp.timeline_event_id) AS perspective_count,
                           COUNT(DISTINCT mp.person_id) AS person_count
                    FROM shared_memories sm
                    LEFT JOIN memory_perspectives mp ON mp.shared_memory_id = sm.id
                    WHERE sm.vault_id = %s
                    GROUP BY sm.id
                    ORDER BY sm.year NULLS LAST, sm.title
                    """,
                    (vault_id,),
                )
                rows = cur.fetchall()
                memories = []
                for r in rows:
                    mid = str(r[0])
                    cur.execute(
                        """
                        SELECT mp.perspective_summary, p.display_name, mp.story_id, te.year
                        FROM memory_perspectives mp
                        LEFT JOIN persons p ON p.id = mp.person_id
                        LEFT JOIN timeline_events te ON te.id = mp.timeline_event_id
                        WHERE mp.shared_memory_id = %s
                        """,
                        (mid,),
                    )
                    perspectives = [
                        {
                            "summary": pr[0],
                            "person_name": pr[1],
                            "story_id": _as_str(pr[2]),
                            "year": pr[3],
                        }
                        for pr in cur.fetchall()
                    ]
                    year, place = r[2], r[3]
                    rationale_bits = []
                    if year is not None:
                        rationale_bits.append(f"year ~{year}")
                    if place:
                        rationale_bits.append(f"place “{place}”")
                    memories.append(
                        {
                            "id": mid,
                            "title": r[1],
                            "year": year,
                            "place": place,
                            "description": r[4],
                            "category": r[5],
                            "confidence": float(r[6]) if r[6] is not None else None,
                            "match_rationale": " · ".join(rationale_bits)
                            if rationale_bits
                            else "overlapping event details",
                            "perspective_count": r[7],
                            "person_count": r[8],
                            "perspectives": perspectives,
                        }
                    )
                return memories
    except Exception as e:
        print("Error list_shared_memories:", e)
        return []


def unlink_shared_memory(memory_id: str, vault_id: str = DEFAULT_VAULT_ID) -> bool:
    """Dissolve a shared-memory cluster; keep underlying timeline events."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id FROM shared_memories
                    WHERE id = %s AND vault_id = %s
                    """,
                    (memory_id, vault_id),
                )
                if not cur.fetchone():
                    return False
                cur.execute(
                    """
                    UPDATE timeline_events
                    SET shared_memory_id = NULL
                    WHERE shared_memory_id = %s
                    """,
                    (memory_id,),
                )
                cur.execute(
                    """
                    UPDATE artifacts
                    SET shared_memory_id = NULL
                    WHERE shared_memory_id = %s
                    """,
                    (memory_id,),
                )
                cur.execute(
                    "DELETE FROM memory_perspectives WHERE shared_memory_id = %s",
                    (memory_id,),
                )
                cur.execute(
                    "DELETE FROM shared_memories WHERE id = %s AND vault_id = %s",
                    (memory_id, vault_id),
                )
                return cur.rowcount > 0
    except Exception as e:
        print("Error unlink_shared_memory:", e)
        return False
