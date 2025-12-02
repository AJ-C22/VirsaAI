"""
Database operations for VirsaAI stories and related data.
Updated to use `raw_body` (original raw text) and `story` (AI processed narrative).
"""
import json
from .db_connection import get_db_connection
from datetime import datetime
from typing import Optional, List, Dict, Any, Optional


# ---------------------------
# SAVING / INSERTING
# ---------------------------
def save_story(person_name: str, raw_body: str, story: str, summary: Optional[str] = None, extracted_data: Optional[Dict] = None) -> Optional[int]:
    """
    Save a story to the database with optional summary and extracted data.
    Args:
        person_name: Name of the person (main storyteller)
        raw_body: Original raw transcript/text
        story: Processed / AI-generated narrative
        summary: Optional summary of the story
        extracted_data: Optional extracted JSON data
    Returns:
        The ID of the inserted story, or None if error occurred
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO stories (person_name, raw_body, story, summary, extracted_data) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (person_name, raw_body, story, summary, json.dumps(extracted_data) if extracted_data else None)
                )
                story_id = cur.fetchone()[0]
                return story_id
    except Exception as e:
        print(f"Error saving story: {e}")
        return None


def save_complete_story(person_name: str, raw_body: str, story: str, summary: str, extracted_data: Dict) -> Optional[int]:
    """
    Save a complete story with all extracted data (person, timeline events, family members, etc.).
    This is the main function to use when saving a processed story.
    Args:
        person_name: Name of the person (main storyteller)
        raw_body: Raw transcript/text
        story: Processed AI narrative
        extracted_data: Dictionary containing all extracted data from extract_key_data()
    Returns:
        The ID of the inserted story, or None if error occurred
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Get person info first
                person_info = extracted_data.get('person_info', {})

                # 1. Save main story (use person_name from parameter, fallback to extracted data)
                story_person_name = person_name or person_info.get('name') or 'Unknown'
                cur.execute(
                    "INSERT INTO stories (person_name, raw_body, story, summary, extracted_data) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (story_person_name, raw_body, story, summary, json.dumps(extracted_data))
                )
                story_id = cur.fetchone()[0]

                # 2. Save person info
                if person_info:
                    cur.execute(
                        """INSERT INTO person (story_id, person_name, person_birth_year, person_birth_place, person_death_year)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (story_id,
                         person_info.get('name'),
                         person_info.get('birth_year'),
                         person_info.get('birth_place'),
                         person_info.get('death_year'))
                    )

                # 3. Save timeline events
                timeline_events = extracted_data.get('timeline_events', [])
                for event in timeline_events:
                    cur.execute(
                        """INSERT INTO timeline_events (story_id, year, event, description, location, category)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (story_id,
                         event.get('year'),
                         event.get('event'),
                         event.get('description'),
                         event.get('location'),
                         event.get('category'))
                    )

                # 4. Save family members
                family_members = extracted_data.get('family_members', [])
                for member in family_members:
                    cur.execute(
                        """INSERT INTO family_members (story_id, name, relationship, birth_year, death_year, notes)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (story_id,
                         member.get('name'),
                         member.get('relationship'),
                         member.get('birth_year'),
                         member.get('death_year'),
                         member.get('notes'))
                    )

                # 5. Save locations
                locations = extracted_data.get('locations', [])
                for location in locations:
                    cur.execute(
                        """INSERT INTO locations (story_id, place, start_year, end_year, purpose)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (story_id,
                         location.get('place'),
                         location.get('start_year'),
                         location.get('end_year'),
                         location.get('purpose'))
                    )

                # 6. Save occupations
                occupations = extracted_data.get('occupations', [])
                for occupation in occupations:
                    cur.execute(
                        """INSERT INTO occupations (story_id, role, start_year, end_year, location)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (story_id,
                         occupation.get('role'),
                         occupation.get('start_year'),
                         occupation.get('end_year'),
                         occupation.get('location'))
                    )

                # 7. Save themes (get or create theme, then link to story)
                themes = extracted_data.get('themes', [])
                for theme_name in themes:
                    if theme_name:
                        # Get or create theme
                        cur.execute("SELECT id FROM themes WHERE name = %s", (theme_name,))
                        theme_row = cur.fetchone()
                        if theme_row:
                            theme_id = theme_row[0]
                        else:
                            cur.execute("INSERT INTO themes (name) VALUES (%s) RETURNING id", (theme_name,))
                            theme_id = cur.fetchone()[0]

                        # Link theme to story
                        cur.execute(
                            """INSERT INTO story_themes (story_id, theme_id)
                               VALUES (%s, %s)
                               ON CONFLICT (story_id, theme_id) DO NOTHING""",
                            (story_id, theme_id)
                        )

                return story_id
    except Exception as e:
        print(f"Error saving complete story: {e}")
        import traceback
        traceback.print_exc()
        return None


# ---------------------------
# GET A SINGLE STORY (full)
# ---------------------------
def get_story_full(story_id: int) -> Optional[Dict]:
    """
    Retrieve a story by ID with all related data.
    Returns a dictionary (single object) or None.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Get main story (note columns raw_body and story)
                cur.execute(
                    """SELECT id, person_name, raw_body, story, summary, extracted_data, created_at, updated_at 
                       FROM stories WHERE id = %s""",
                    (story_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None

                story_obj = {
                    'id': row[0],
                    'person_name': row[1],
                    'raw_body': row[2],
                    'story': row[3],
                    'summary': row[4],
                    'extracted_data': json.loads(row[5]) if row[5] else None,
                    'created_at': row[6],
                    'updated_at': row[7]
                }

                # Get person info
                cur.execute(
                    """SELECT person_name, person_birth_year, person_birth_place, person_death_year
                       FROM person WHERE story_id = %s""",
                    (story_id,)
                )
                person_row = cur.fetchone()
                if person_row:
                    story_obj['person'] = {
                        'name': person_row[0],
                        'birth_year': person_row[1],
                        'birth_place': person_row[2],
                        'death_year': person_row[3]
                    }

                # Get timeline events
                cur.execute(
                    """SELECT id, year, event, description, location, category, created_at
                       FROM timeline_events WHERE story_id = %s ORDER BY year NULLS LAST, created_at""",
                    (story_id,)
                )
                story_obj['timeline_events'] = [
                    {
                        'id': r[0],
                        'year': r[1],
                        'event': r[2],
                        'description': r[3],
                        'location': r[4],
                        'category': r[5],
                        'created_at': r[6]
                    }
                    for r in cur.fetchall()
                ]

                # Get family members
                cur.execute(
                    """SELECT id, name, relationship, birth_year, death_year, notes, created_at
                       FROM family_members WHERE story_id = %s""",
                    (story_id,)
                )
                story_obj['family_members'] = [
                    {
                        'id': r[0],
                        'name': r[1],
                        'relationship': r[2],
                        'birth_year': r[3],
                        'death_year': r[4],
                        'notes': r[5],
                        'created_at': r[6]
                    }
                    for r in cur.fetchall()
                ]

                # Get locations
                cur.execute(
                    """SELECT id, place, start_year, end_year, purpose, created_at
                       FROM locations WHERE story_id = %s ORDER BY start_year NULLS LAST""",
                    (story_id,)
                )
                story_obj['locations'] = [
                    {
                        'id': r[0],
                        'place': r[1],
                        'start_year': r[2],
                        'end_year': r[3],
                        'purpose': r[4],
                        'created_at': r[5]
                    }
                    for r in cur.fetchall()
                ]

                # Get occupations
                cur.execute(
                    """SELECT id, role, start_year, end_year, location, created_at
                       FROM occupations WHERE story_id = %s ORDER BY start_year NULLS LAST""",
                    (story_id,)
                )
                story_obj['occupations'] = [
                    {
                        'id': r[0],
                        'role': r[1],
                        'start_year': r[2],
                        'end_year': r[3],
                        'location': r[4],
                        'created_at': r[5]
                    }
                    for r in cur.fetchall()
                ]

                # Get themes
                cur.execute(
                    """SELECT t.id, t.name
                       FROM themes t
                       JOIN story_themes st ON t.id = st.theme_id
                       WHERE st.story_id = %s""",
                    (story_id,)
                )
                story_obj['themes'] = [
                    {'id': r[0], 'name': r[1]}
                    for r in cur.fetchall()
                ]

                return story_obj
    except Exception as e:
        print(f"Error retrieving story: {e}")
        import traceback
        traceback.print_exc()
        return None


# ---------------------------
# GET A SIMPLE STORY (for frontend story page)
# ---------------------------
def get_story(story_id: int) -> Optional[Dict]:
    """
    Return a single object with keys: story_id, person_name, story (AI narrative), raw_body, created_at, updated_at
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, person_name, story, raw_body, created_at, updated_at
                    FROM stories
                    WHERE id = %s
                """, (story_id,))

                row = cur.fetchone()

        if not row:
            return None

        return {
            "story_id": row[0],
            "person_name": row[1] or "Unknown",
            "story": row[2] or "",
            "raw_body": row[3] or "",
            "created_at": row[4],
            "updated_at": row[5]
        }

    except Exception as e:
        print("Error retrieving story (simple):", e)
        return None


# ---------------------------
# GET ALL STORIES (list for library / cards)
# ---------------------------
def get_all_stories() -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        s.id AS story_id,
                        s.person_name,
                        LENGTH(s.raw_body) AS char_count,
                        s.story,
                        s.created_at,
                        s.updated_at,
                        s.summary
                    FROM stories s;
                """)

                rows = cur.fetchall()

        # Build safe output for frontend
        return [
            {
                "story_id": r[0],
                "person_name": r[1] or "Unknown",
                "character_count": r[2] or 0,
                "story": r[3] or "",
                "created_at": r[4],
                "updated_at": r[5],
                "summary": r[6]
            }
            for r in rows
        ]

    except Exception as e:
        print("Error retrieving stories:", e)
        return []


# ---------------------------
# GET ALL PEOPLE (for timeline/people list)
# ---------------------------
def get_all_people() -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        s.id AS story_id,
                        s.person_name,
                        COUNT(te.id) AS event_count,
                        s.updated_at
                    FROM stories s
                    LEFT JOIN timeline_events te ON te.story_id = s.id
                    WHERE s.person_name IS NOT NULL
                    GROUP BY s.id, s.person_name, s.updated_at
                    ORDER BY s.updated_at DESC;
                """)

                rows = cur.fetchall()

        # Prevent NULLs and make frontend safe
        return [
            {
                "story_id": r[0],
                "person_name": r[1] if r[1] else "Unknown",
                "event_count": r[2],
                "updated_at": r[3],
            }
            for r in rows
        ]

    except Exception as e:
        print(f"Error retrieving stories: {e}")
        return []


# ---------------------------
# PAGED/LIMITED LISTED get_all_stories
# ---------------------------
def get_all_stories_limited(limit: int = 100) -> List[Dict]:
    """
    Retrieve all stories, ordered by creation date (newest first).
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, person_name, summary, created_at 
                       FROM stories 
                       ORDER BY created_at DESC LIMIT %s""",
                    (limit,)
                )
                rows = cur.fetchall()
                return [
                    {
                        'id': row[0],
                        'person_name': row[1],
                        'summary': row[2],
                        'created_at': row[3]
                    }
                    for row in rows
                ]
    except Exception as e:
        print(f"Error retrieving stories: {e}")
        return []


# ---------------------------
# Stories by theme
# ---------------------------
def get_stories_by_theme(theme_name: str, limit: int = 100) -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT DISTINCT s.id, s.person_name, s.summary, s.created_at
                       FROM stories s
                       JOIN story_themes st ON s.id = st.story_id
                       JOIN themes t ON st.theme_id = t.id
                       WHERE t.name = %s
                       ORDER BY s.created_at DESC
                       LIMIT %s""",
                    (theme_name, limit)
                )
                rows = cur.fetchall()
                return [
                    {
                        'id': row[0],
                        'person_name': row[1],
                        'summary': row[2],
                        'created_at': row[3]
                    }
                    for row in rows
                ]
    except Exception as e:
        print(f"Error retrieving stories by theme: {e}")
        return []


# ---------------------------
# Timeline events (unchanged)
# ---------------------------
def get_timeline_events(story_id: int) -> List[Dict]:
    """
    Get all timeline events for a story, ordered chronologically.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, year, event, description, location, category, created_at
                       FROM timeline_events 
                       WHERE story_id = %s 
                       ORDER BY year NULLS LAST, created_at""",
                    (story_id,)
                )
                return [
                    {
                        'id': row[0],
                        'year': row[1],
                        'event': row[2],
                        'description': row[3],
                        'location': row[4],
                        'category': row[5],
                        'created_at': row[6]
                    }
                    for row in cur.fetchall()
                ]
    except Exception as e:
        print(f"Error retrieving timeline events: {e}")
        return []

# --- Family members CRUD for the interactive tree ---
# --- Family members CRUD for the interactive tree ---

def get_all_family_members() -> List[Dict]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, story_id, name, relationship, birth_year, death_year, notes,
                           created_at, updated_at
                    FROM family_members
                    ORDER BY id
                """)
                rows = cur.fetchall()

        return [
            {
                "id": r[0],
                "story_id": r[1],
                "name": r[2],
                "relationship": r[3],
                "birth_year": r[4],
                "death_year": r[5],
                "notes": r[6],
                "created_at": r[7],
                "updated_at": r[8],
            }
            for r in rows
        ]
    except Exception as e:
        print("Error get_all_family_members:", e)
        return []


def create_family_member_global(name: str,
                                relationship: str,
                                story_id: Optional[int]=None,
                                birth_year: Optional[int]=None,
                                death_year: Optional[int]=None,
                                notes: Optional[str]=None) -> Optional[int]:

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO family_members
                        (story_id, name, relationship, birth_year, death_year, notes)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """,
                (story_id, name, relationship, birth_year, death_year, notes))

                row = cur.fetchone()
                return row[0] if row else None

    except Exception as e:
        print("Error create_family_member_global:", e)
        return None



def update_family_member(member_id: int, name: Optional[str]=None, relationship: Optional[str]=None, birth_year: Optional[int]=None, death_year: Optional[int]=None, notes: Optional[str]=None) -> bool:
    try:
        updates = []
        vals = []
        if name is not None:
            updates.append("name = %s"); vals.append(name)
        if relationship is not None:
            updates.append("relationship = %s"); vals.append(relationship)
        if birth_year is not None:
            updates.append("birth_year = %s"); vals.append(birth_year)
        if death_year is not None:
            updates.append("death_year = %s"); vals.append(death_year)
        if notes is not None:
            updates.append("notes = %s"); vals.append(notes)
        if not updates:
            return False
        vals.append(member_id)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE family_members SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s", tuple(vals))
                return cur.rowcount > 0
    except Exception as e:
        print("Error update_family_member:", e)
        return False


def delete_family_member(member_id: int) -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM family_members WHERE id = %s", (member_id,))
                return cur.rowcount > 0
    except Exception as e:
        print("Error delete_family_member:", e)
        return False

# ---------------------------
# DELETE / UPDATE
# ---------------------------
def delete_story(story_id: int) -> bool:
    """
    Delete a story by ID (cascades to all related data).
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM stories WHERE id = %s", (story_id,))
                return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting story: {e}")
        return False


def update_story(story_id: int, person_name: Optional[str] = None, raw_body: Optional[str] = None, 
                 story: Optional[str] = None, summary: Optional[str] = None) -> bool:
    """
    Update an existing story.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                updates = []
                values = []

                if person_name is not None:
                    updates.append("person_name = %s")
                    values.append(person_name)
                if raw_body is not None:
                    updates.append("raw_body = %s")
                    values.append(raw_body)
                if story is not None:
                    updates.append("story = %s")
                    values.append(story)
                if summary is not None:
                    updates.append("summary = %s")
                    values.append(summary)

                if not updates:
                    return False

                updates.append("updated_at = NOW()")
                values.append(story_id)
                query = f"UPDATE stories SET {', '.join(updates)} WHERE id = %s"
                cur.execute(query, values)
                return cur.rowcount > 0
    except Exception as e:
        print("Error updating story:", e)
        return False
