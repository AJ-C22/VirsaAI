"""
Database operations for VirsaAI stories and related data.
"""
import json
from .db_connection import get_db_connection
from datetime import datetime
from typing import Optional, List, Dict, Any


def save_story(person_name: str, body: str, summary: Optional[str] = None, extracted_data: Optional[Dict] = None) -> Optional[int]:
    """
    Save a story to the database with optional summary and extracted data.
    
    Args:
        person_name: Name of the person (main storyteller)
        body: Story content/body
        summary: Optional summary of the story
        extracted_data: Optional extracted JSON data
        
    Returns:
        The ID of the inserted story, or None if error occurred
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO stories (person_name, body, summary, extracted_data) VALUES (%s, %s, %s, %s) RETURNING id",
                    (person_name, body, summary, json.dumps(extracted_data) if extracted_data else None)
                )
                story_id = cur.fetchone()[0]
                return story_id
    except Exception as e:
        print(f"Error saving story: {e}")
        return None


def save_complete_story(person_name: str, body: str, extracted_data: Dict) -> Optional[int]:
    """
    Save a complete story with all extracted data (person, timeline events, family members, etc.).
    This is the main function to use when saving a processed story.
    
    Args:
        person_name: Name of the person (main storyteller)
        body: Story content/body
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
                    "INSERT INTO stories (person_name, body, summary, extracted_data) VALUES (%s, %s, %s, %s) RETURNING id",
                    (story_person_name, body, extracted_data.get('summary'), json.dumps(extracted_data))
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


def get_story(story_id: int) -> Optional[Dict]:
    """
    Retrieve a story by ID with all related data.
    
    Args:
        story_id: The ID of the story to retrieve
        
    Returns:
        Dictionary with complete story data, or None if not found
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Get main story
                cur.execute(
                    """SELECT id, person_name, body, summary, extracted_data, created_at, updated_at 
                       FROM stories WHERE id = %s""",
                    (story_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                story = {
                    'id': row[0],
                    'person_name': row[1],
                    'body': row[2],
                    'summary': row[3],
                    'extracted_data': json.loads(row[4]) if row[4] else None,
                    'created_at': row[5],
                    'updated_at': row[6]
                }
                
                # Get person info
                cur.execute(
                    """SELECT person_name, person_birth_year, person_birth_place, person_death_year
                       FROM person WHERE story_id = %s""",
                    (story_id,)
                )
                person_row = cur.fetchone()
                if person_row:
                    story['person'] = {
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
                story['timeline_events'] = [
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
                
                # Get family members
                cur.execute(
                    """SELECT id, name, relationship, birth_year, death_year, notes, created_at
                       FROM family_members WHERE story_id = %s""",
                    (story_id,)
                )
                story['family_members'] = [
                    {
                        'id': row[0],
                        'name': row[1],
                        'relationship': row[2],
                        'birth_year': row[3],
                        'death_year': row[4],
                        'notes': row[5],
                        'created_at': row[6]
                    }
                    for row in cur.fetchall()
                ]
                
                # Get locations
                cur.execute(
                    """SELECT id, place, start_year, end_year, purpose, created_at
                       FROM locations WHERE story_id = %s ORDER BY start_year NULLS LAST""",
                    (story_id,)
                )
                story['locations'] = [
                    {
                        'id': row[0],
                        'place': row[1],
                        'start_year': row[2],
                        'end_year': row[3],
                        'purpose': row[4],
                        'created_at': row[5]
                    }
                    for row in cur.fetchall()
                ]
                
                # Get occupations
                cur.execute(
                    """SELECT id, role, start_year, end_year, location, created_at
                       FROM occupations WHERE story_id = %s ORDER BY start_year NULLS LAST""",
                    (story_id,)
                )
                story['occupations'] = [
                    {
                        'id': row[0],
                        'role': row[1],
                        'start_year': row[2],
                        'end_year': row[3],
                        'location': row[4],
                        'created_at': row[5]
                    }
                    for row in cur.fetchall()
                ]
                
                # Get themes
                cur.execute(
                    """SELECT t.id, t.name
                       FROM themes t
                       JOIN story_themes st ON t.id = st.theme_id
                       WHERE st.story_id = %s""",
                    (story_id,)
                )
                story['themes'] = [
                    {'id': row[0], 'name': row[1]}
                    for row in cur.fetchall()
                ]
                
                return story
    except Exception as e:
        print(f"Error retrieving story: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_all_people():
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


def get_all_stories(limit: int = 100) -> List[Dict]:
    """
    Retrieve all stories, ordered by creation date (newest first).
    
    Args:
        limit: Maximum number of stories to retrieve
        
    Returns:
        List of story dictionaries (basic info only, use get_story() for full data)
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


def get_stories_by_theme(theme_name: str, limit: int = 100) -> List[Dict]:
    """
    Retrieve stories that have a specific theme.
    
    Args:
        theme_name: Name of the theme to search for
        limit: Maximum number of stories to retrieve
        
    Returns:
        List of story dictionaries
    """
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


def get_timeline_events(story_id: int) -> List[Dict]:
    """
    Get all timeline events for a story, ordered chronologically.
    
    Args:
        story_id: The story ID
        
    Returns:
        List of timeline event dictionaries
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


def delete_story(story_id: int) -> bool:
    """
    Delete a story by ID (cascades to all related data).
    
    Args:
        story_id: The ID of the story to delete
        
    Returns:
        True if deleted, False otherwise
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM stories WHERE id = %s", (story_id,))
                return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting story: {e}")
        return False


def update_story(story_id: int, person_name: Optional[str] = None, body: Optional[str] = None, 
                 summary: Optional[str] = None) -> bool:
    """
    Update an existing story.
    
    Args:
        story_id: The ID of the story to update
        person_name: New person name (optional)
        body: New body content (optional)
        summary: New summary (optional)
        
    Returns:
        True if updated, False otherwise
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                updates = []
                values = []
                
                if person_name is not None:
                    updates.append("person_name = %s")
                    values.append(person_name)
                if body is not None:
                    updates.append("body = %s")
                    values.append(body)
                if summary is not None:
                    updates.append("summary = %s")
                    values.append(summary)
                
                if not updates:
                    return False
                
                values.append(story_id)
                query = f"UPDATE stories SET {', '.join(updates)} WHERE id = %s"
                cur.execute(query, values)
                return cur.rowcount > 0
    except Exception as e:
        print(f"Error updating story: {e}")
        return False
