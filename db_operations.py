"""
Database operations for VirsaAI stories.
"""
from db_connection import get_db_connection
from datetime import datetime
from typing import Optional, List, Dict


def save_story(title: str, body: str) -> Optional[int]:
    """
    Save a story to the database.
    
    Args:
        title: Story title
        body: Story content/body
        
    Returns:
        The ID of the inserted story, or None if error occurred
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO stories (title, body) VALUES (%s, %s) RETURNING id",
                    (title, body)
                )
                story_id = cur.fetchone()[0]
                return story_id
    except Exception as e:
        print(f"Error saving story: {e}")
        return None


def get_story(story_id: int) -> Optional[Dict]:
    """
    Retrieve a story by ID.
    
    Args:
        story_id: The ID of the story to retrieve
        
    Returns:
        Dictionary with story data, or None if not found
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, title, body, created_at FROM stories WHERE id = %s",
                    (story_id,)
                )
                row = cur.fetchone()
                if row:
                    return {
                        'id': row[0],
                        'title': row[1],
                        'body': row[2],
                        'created_at': row[3]
                    }
                return None
    except Exception as e:
        print(f"Error retrieving story: {e}")
        return None


def get_all_stories(limit: int = 100) -> List[Dict]:
    """
    Retrieve all stories, ordered by creation date (newest first).
    
    Args:
        limit: Maximum number of stories to retrieve
        
    Returns:
        List of story dictionaries
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, title, body, created_at FROM stories ORDER BY created_at DESC LIMIT %s",
                    (limit,)
                )
                rows = cur.fetchall()
                return [
                    {
                        'id': row[0],
                        'title': row[1],
                        'body': row[2],
                        'created_at': row[3]
                    }
                    for row in rows
                ]
    except Exception as e:
        print(f"Error retrieving stories: {e}")
        return []


def delete_story(story_id: int) -> bool:
    """
    Delete a story by ID.
    
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


def update_story(story_id: int, title: str, body: str) -> bool:
    """
    Update an existing story.
    
    Args:
        story_id: The ID of the story to update
        title: New title
        body: New body content
        
    Returns:
        True if updated, False otherwise
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE stories SET title = %s, body = %s WHERE id = %s",
                    (title, body, story_id)
                )
                return cur.rowcount > 0
    except Exception as e:
        print(f"Error updating story: {e}")
        return False

