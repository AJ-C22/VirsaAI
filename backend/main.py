from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.db_operations import *

app = FastAPI()

# Allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/timeline/{story_id}")
def timeline(story_id: int):
    """
    Returns timeline events for a given story_id.
    """
    return get_timeline_events(story_id)

@app.get("/timeline")
def list_people():
    """
    Returns the list of people with their story/timeline metadata.
    """
    return get_all_people()

@app.get("/story_library")
def list_stories():
    """
    Returns the list of people with their story.
    """
    return get_all_stories()

# Optional: A test function you can run manually
def main():
    print(get_timeline_events(4))
