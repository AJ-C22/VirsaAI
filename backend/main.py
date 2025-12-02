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

@app.get("/story/{story_id}")
def story(story_id: int):
    print("HIT BACKEND WITH:", story_id)
    return get_story(story_id)

@app.get("/family")
def read_all_family():
    return get_all_family_members()

@app.post("/family/member")
def create_member(payload: dict):
    member_id = create_family_member_global(
        name=payload.get("name"),
        relationship=payload.get("relationship") or "relative",
        story_id=payload.get("story_id"),  # optional but allowed
        birth_year=payload.get("birth_year"),
        death_year=payload.get("death_year"),
        notes=payload.get("notes")
    )
    if not member_id:
        raise HTTPException(status_code=500, detail="Failed to create member")
    return {"id": member_id}

@app.patch("/family/member/{member_id}")
def update_member(member_id: int, payload: dict):
    ok = update_family_member(
        member_id=member_id,
        name=payload.get("name"),
        relationship=payload.get("relationship"),
        birth_year=payload.get("birth_year"),
        death_year=payload.get("death_year"),
        notes=payload.get("notes")
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to update")
    return {"ok": True}

@app.delete("/family/member/{member_id}")
def delete_member(member_id: int):
    ok = delete_family_member(member_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete")
    return {"ok": True}


# Optional: A test function you can run manually
def main():
    print(get_timeline_events(4))
