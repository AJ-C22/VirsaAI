import os
import threading
import uuid
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import (
    Body,
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from auth import (
    ADMIN_ROLES,
    PLAN_LIMITS,
    WRITE_ROLES,
    accept_invite,
    assert_vault_member,
    check_story_quota,
    create_invite,
    decode_token,
    get_user_vaults,
    list_invites,
    login_user,
    peek_invite,
    register_user,
    revoke_invite,
    set_vault_plan,
    vault_dashboard_stats,
)
from alerts import format_exception, record_error
from billing import (
    create_checkout_session,
    create_portal_session,
    handle_webhook,
    stripe_configured,
    sync_checkout_session,
)
from db.db_operations import (
    add_media_asset,
    confirm_suggestion,
    create_artifact,
    create_family_member_global,
    create_person,
    create_processing_job,
    create_relationship,
    create_story_shell,
    delete_family_member,
    delete_relationship,
    delete_story,
    get_all_people,
    get_all_stories,
    get_artifact,
    get_entity_vault_id,
    get_family_graph,
    get_master_timeline,
    get_processing_status,
    get_story,
    get_story_full,
    _moment_year,
    get_timeline_events,
    update_artifact_moment,
    update_timeline_event,
    get_vault,
    link_shared_memories_for_vault,
    list_artifacts,
    list_shared_memories,
    list_suggestions,
    reject_suggestion,
    search_archive,
    set_story_status,
    unlink_shared_memory,
    update_family_member,
    update_relationship,
    update_vault_culture,
)
from mailer import send_invite_email
from pipeline import process_transcript_story, process_uploaded_story
from rate_limit import allow

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="VirsaAI API", version="2.2.0")

_cors_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
# Dev escape hatch only — never leave CORS_ORIGINS=* in production
if _cors_origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _too_many(request: Request, bucket: str, limit: int) -> None:
    host = request.client.host if request.client else "local"
    if not allow(f"{bucket}:{host}", limit):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Try again in a minute.",
        )


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    if isinstance(exc, RequestValidationError):
        return JSONResponse(status_code=422, content={"detail": exc.errors()})
    record_error(request.url.path, str(exc), format_exception(exc))
    return JSONResponse(status_code=500, content={"detail": "Something went wrong"})


@app.get("/health")
def health_check():
    return {"status": "ok", "schema": "v2.2", "product": "living-family-history"}


def _optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return decode_token(authorization.split(" ", 1)[1].strip())


def _require_user(authorization: Optional[str] = Header(None)) -> dict:
    user = _optional_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Sign in required")
    return user


def _resolve_vault_id(explicit: Optional[str], user: dict) -> str:
    """Prefer explicit vault_id; else first vault the user belongs to."""
    if explicit:
        return explicit
    vaults = get_user_vaults(user["sub"])
    if not vaults:
        raise HTTPException(status_code=400, detail="No vault available for this account")
    return vaults[0]["id"]


def _require_vault(
    user: dict,
    vault_id: Optional[str],
    *,
    write: bool = False,
    admin: bool = False,
) -> str:
    vid = _resolve_vault_id(vault_id, user)
    roles = ADMIN_ROLES if admin else (WRITE_ROLES if write else None)
    try:
        assert_vault_member(user["sub"], vid, roles=roles)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return vid


def _require_entity_vault(
    user: dict,
    kind: str,
    entity_id: str,
    *,
    write: bool = False,
) -> str:
    vault_id = get_entity_vault_id(kind, entity_id)
    if not vault_id:
        raise HTTPException(status_code=404, detail=f"{kind.replace('_', ' ').title()} not found")
    try:
        assert_vault_member(
            user["sub"],
            vault_id,
            roles=WRITE_ROLES if write else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return vault_id


@app.post("/auth/register")
def auth_register(payload: dict, request: Request):
    _too_many(request, "auth", int(os.getenv("RATE_LIMIT_AUTH") or "10"))
    try:
        return register_user(
            email=payload.get("email", ""),
            password=payload.get("password", ""),
            display_name=payload.get("display_name"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login")
def auth_login(payload: dict, request: Request):
    _too_many(request, "auth", int(os.getenv("RATE_LIMIT_AUTH") or "10"))
    try:
        return login_user(payload.get("email", ""), payload.get("password", ""))
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.get("/auth/me")
def auth_me(user: dict = Depends(_require_user)):
    vaults = get_user_vaults(user["sub"])
    return {"user": {"id": user["sub"], "email": user.get("email")}, "vaults": vaults}


@app.get("/dashboard")
def dashboard(
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    try:
        return vault_dashboard_stats(vid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/plans")
def plans():
    return {
        "plans": [
            {
                "id": "free",
                "name": "Free",
                "price_monthly": 0,
                "story_limit": PLAN_LIMITS["free"]["story_limit"],
                "member_limit": PLAN_LIMITS["free"]["member_limit"],
                "features": [
                    "5 archived oral histories",
                    "Family tree + timelines",
                    "Cultural kinship labels",
                    "1 family vault",
                ],
            },
            {
                "id": "family",
                "name": "Family",
                "price_monthly": 19,
                "story_limit": PLAN_LIMITS["family"]["story_limit"],
                "member_limit": PLAN_LIMITS["family"]["member_limit"],
                "features": [
                    "50 oral histories",
                    "Shared memories across relatives",
                    "Artifacts & archive search",
                    "Invite up to 15 family members",
                ],
                "highlighted": True,
            },
            {
                "id": "legacy",
                "name": "Legacy",
                "price_monthly": 49,
                "story_limit": None,
                "member_limit": None,
                "features": [
                    "Unlimited stories & members",
                    "Priority processing",
                    "Export / heirloom packages",
                    "Early access to cultural packs",
                ],
            },
        ],
        "stripe_configured": stripe_configured(),
        "note": (
            "Stripe Checkout live"
            if stripe_configured()
            else "Add STRIPE_SECRET_KEY + STRIPE_PRICE_* to enable Checkout; Free plan works anytime."
        ),
    }


@app.post("/billing/checkout")
def billing_checkout(payload: dict, user: dict = Depends(_require_user)):
    vault_id = _require_vault(user, payload.get("vault_id"), admin=True)
    plan = (payload.get("plan") or "").strip().lower()
    email = user.get("email") or ""
    try:
        return create_checkout_session(
            vault_id=vault_id,
            plan=plan,
            user_id=user["sub"],
            email=email,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")


@app.post("/billing/portal")
def billing_portal(payload: dict, user: dict = Depends(_require_user)):
    vault_id = _require_vault(user, payload.get("vault_id"), admin=True)
    try:
        return create_portal_session(vault_id=vault_id, user_id=user["sub"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")


@app.get("/billing/session/{session_id}")
def billing_session(session_id: str, user: dict = Depends(_require_user)):
    try:
        return sync_checkout_session(session_id, user_id=user["sub"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")


@app.post("/billing/webhook")
async def billing_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
):
    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature")
    try:
        return handle_webhook(payload, stripe_signature)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/billing/set-plan")
def billing_set_plan(payload: dict, user: dict = Depends(_require_user)):
    """Dev plan switcher when Stripe is not configured. Owner-only."""
    if stripe_configured():
        raise HTTPException(
            status_code=400,
            detail="Use /billing/checkout for plan changes while Stripe is configured",
        )
    vault_id = _require_vault(user, payload.get("vault_id"), admin=True)
    plan = payload.get("plan") or "free"
    try:
        set_vault_plan(vault_id, plan)
        return vault_dashboard_stats(vault_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/vaults/invite")
def vault_invite(payload: dict, request: Request, user: dict = Depends(_require_user)):
    _too_many(request, "invite", int(os.getenv("RATE_LIMIT_INVITE") or "20"))
    vault_id = _require_vault(user, payload.get("vault_id"), write=True)
    try:
        invite = create_invite(
            vault_id=vault_id,
            email=payload.get("email", ""),
            role=payload.get("role") or "editor",
            invited_by=user["sub"],
        )
        base = (os.getenv("APP_URL") or "http://127.0.0.1:3000").rstrip("/")
        vault = get_vault(vault_id) or {}
        invite["email_delivery"] = send_invite_email(
            invite["email"],
            f"{base}{invite['invite_url']}",
            vault.get("name") or "your family",
            payload.get("role") or "editor",
        )
        return invite
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/vaults/invites")
def vault_invites_list(
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return {"invites": list_invites(vid)}


@app.post("/vaults/invites/{invite_id}/revoke")
def vault_invite_revoke(
    invite_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(_require_user),
):
    vault_id = _require_vault(user, payload.get("vault_id"), write=True)
    if not revoke_invite(invite_id, vault_id):
        raise HTTPException(status_code=404, detail="Invite not found or already closed")
    return {"ok": True}


@app.get("/vaults/invite/{token}")
def vault_invite_peek(token: str):
    try:
        return peek_invite(token)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/vaults/accept-invite")
def vault_accept_invite(payload: dict, user: dict = Depends(_require_user)):
    try:
        vault_id = accept_invite(payload.get("token", ""), user["sub"])
        return {"vault_id": vault_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/vault")
def vault_get(
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    result = get_vault(vid)
    if not result:
        raise HTTPException(status_code=404, detail="Vault not found")
    return result


@app.patch("/vault")
def vault_update(payload: dict, user: dict = Depends(_require_user)):
    vault_id = _require_vault(user, payload.get("vault_id"), write=True)
    ok = update_vault_culture(
        vault_id=vault_id,
        cultural_context=payload.get("cultural_context"),
        kinship_system=payload.get("kinship_system"),
        primary_language=payload.get("primary_language"),
        name=payload.get("name"),
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to update vault")
    return get_vault(vault_id)


@app.get("/archive/search")
def archive_search(
    q: str = Query(...),
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return search_archive(q, vid)


@app.get("/shared-memories")
def shared_memories(
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return list_shared_memories(vid)


@app.post("/shared-memories/relink")
def shared_memories_relink(
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id, write=True)
    created = link_shared_memories_for_vault(vid)
    return {
        "created_or_updated_clusters": created,
        "memories": list_shared_memories(vid),
    }


@app.delete("/shared-memories/{memory_id}")
def shared_memory_unlink(
    memory_id: str,
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    # Prefer entity vault; fall back to query vault after membership check
    entity_vault = get_entity_vault_id("shared_memory", memory_id)
    if entity_vault:
        vid = _require_vault(user, entity_vault, write=True)
    else:
        vid = _require_vault(user, vault_id, write=True)
    if not unlink_shared_memory(memory_id, vid):
        raise HTTPException(status_code=404, detail="Shared memory not found")
    return {"ok": True, "memories": list_shared_memories(vid)}


@app.get("/artifacts")
def artifacts_list(
    vault_id: Optional[str] = Query(None),
    person_id: Optional[str] = None,
    artifact_type: Optional[str] = None,
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return list_artifacts(vid, person_id, artifact_type)


@app.get("/artifacts/{artifact_id}/file")
def artifact_file(artifact_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "artifact", artifact_id)
    artifact = get_artifact(artifact_id)
    if not artifact or not artifact.get("storage_path"):
        raise HTTPException(status_code=404, detail="Artifact not found")
    path = Path(artifact["storage_path"])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact file missing on disk")
    return FileResponse(
        path,
        media_type=artifact.get("mime_type") or "application/octet-stream",
        filename=path.name,
    )


@app.post("/artifacts/upload")
async def artifacts_upload(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    artifact_type: str = Form("photo"),
    person_id: Optional[str] = Form(None),
    story_id: Optional[str] = Form(None),
    taken_year: Optional[int] = Form(None),
    taken_place: Optional[str] = Form(None),
    vault_id: Optional[str] = Form(None),
    user: dict = Depends(_require_user),
):
    _too_many(request, "upload", int(os.getenv("RATE_LIMIT_UPLOAD") or "10"))
    vid = _require_vault(user, vault_id, write=True)
    artifact_dir = UPLOAD_DIR / "artifacts"
    artifact_dir.mkdir(exist_ok=True)
    content = await file.read()
    ext = Path(file.filename or "file.bin").suffix or ".bin"
    dest = artifact_dir / f"{uuid.uuid4()}{ext}"
    dest.write_bytes(content)
    artifact_id = create_artifact(
        title=title or file.filename or "Family artifact",
        storage_path=str(dest),
        artifact_type=artifact_type,
        vault_id=vid,
        caption=caption,
        mime_type=file.content_type,
        byte_size=len(content),
        person_id=person_id,
        story_id=story_id,
        taken_year=taken_year,
        taken_place=taken_place,
    )
    if not artifact_id:
        raise HTTPException(status_code=500, detail="Failed to save artifact")
    return {
        "id": artifact_id,
        "title": title or file.filename,
        "file_url": f"/artifacts/{artifact_id}/file",
    }


@app.get("/timeline")
def list_people(
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return get_all_people(vid)


@app.get("/master-timeline")
def master_timeline(
    vault_id: Optional[str] = Query(None),
    person_id: Optional[List[str]] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return get_master_timeline(vid, person_id)


@app.patch("/timeline/moments/{moment_id}")
def patch_timeline_moment(moment_id: str, payload: dict, user: dict = Depends(_require_user)):
    """Edit the title, description, place, or year of one timeline moment."""
    title = payload.get("title") if "title" in payload else payload.get("event")
    description = payload.get("description")
    place = payload.get("place") if "place" in payload else payload.get("location")
    try:
        year = _moment_year(payload.get("year")) if "year" in payload else None
        if moment_id.startswith("artifact:"):
            artifact_id = moment_id.split(":", 1)[1]
            _require_entity_vault(user, "artifact", artifact_id, write=True)
            updated = update_artifact_moment(artifact_id, title or "", description, place, year)
        else:
            _require_entity_vault(user, "timeline_event", moment_id, write=True)
            updated = update_timeline_event(moment_id, title or "", description, place, year)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Moment not found")
    return updated


@app.get("/timeline/{entity_id}")
def timeline(entity_id: str, user: dict = Depends(_require_user)):
    # entity may be person id (preferred) or legacy story id
    vault_id = get_entity_vault_id("person", entity_id) or get_entity_vault_id(
        "story", entity_id
    )
    if not vault_id:
        raise HTTPException(status_code=404, detail="Timeline not found")
    try:
        assert_vault_member(user["sub"], vault_id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return get_timeline_events(entity_id)


@app.get("/story_library")
def list_stories(
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return get_all_stories(vid)


@app.get("/story/{story_id}")
def story(story_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "story", story_id)
    result = get_story(story_id)
    if not result:
        raise HTTPException(status_code=404, detail="Story not found")
    return result


@app.get("/story/{story_id}/full")
def story_full(story_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "story", story_id)
    result = get_story_full(story_id)
    if not result:
        raise HTTPException(status_code=404, detail="Story not found")
    return result


@app.delete("/story/{story_id}")
def story_delete(story_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "story", story_id, write=True)
    result = delete_story(story_id)
    if not result:
        raise HTTPException(status_code=404, detail="Story not found")
    return {"ok": True, **result}


@app.get("/story/{story_id}/status")
def story_status(story_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "story", story_id)
    result = get_processing_status(story_id)
    if not result:
        raise HTTPException(status_code=404, detail="Story not found")
    return result


def _start_audio_job(
    story_id: str,
    job_id: str,
    audio_path: str,
    person_name: Optional[str],
    auto_confirm: bool,
):
    set_story_status(story_id, "processing")
    process_uploaded_story(
        story_id=story_id,
        job_id=job_id,
        audio_path=audio_path,
        person_name_hint=person_name,
        auto_confirm=auto_confirm,
    )


def _start_transcript_job(
    story_id: str,
    job_id: str,
    transcript: str,
    person_name: Optional[str],
    auto_confirm: bool,
):
    set_story_status(story_id, "processing")
    process_transcript_story(
        story_id=story_id,
        job_id=job_id,
        transcript=transcript,
        person_name_hint=person_name,
        auto_confirm=auto_confirm,
    )


@app.post("/stories/upload")
async def upload_story(
    request: Request,
    file: UploadFile = File(...),
    person_name: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    vault_id: Optional[str] = Form(None),
    auto_confirm: bool = Form(False),
    user: dict = Depends(_require_user),
):
    """Upload oral history audio → async Whisper + Gemini pipeline."""
    _too_many(request, "upload", int(os.getenv("RATE_LIMIT_UPLOAD") or "10"))
    if not os.getenv("GEMINI_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_KEY is not configured")

    vid = _require_vault(user, vault_id, write=True)
    quota = check_story_quota(vid)
    if not quota.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail=quota.get("reason") or "Plan limit reached. Upgrade to continue.",
        )

    story_id = create_story_shell(
        vault_id=vid,
        title=title or person_name or (file.filename or "New recording"),
        contributor_id=user["sub"],
    )
    if not story_id:
        raise HTTPException(status_code=500, detail="Failed to create story")

    ext = Path(file.filename or "audio.webm").suffix or ".webm"
    dest = UPLOAD_DIR / f"{story_id}{ext}"
    content = await file.read()
    dest.write_bytes(content)

    add_media_asset(
        story_id=story_id,
        storage_path=str(dest),
        mime_type=file.content_type,
        byte_size=len(content),
    )
    job_id = create_processing_job(story_id)
    if not job_id:
        raise HTTPException(status_code=500, detail="Failed to create processing job")

    thread = threading.Thread(
        target=_start_audio_job,
        args=(story_id, job_id, str(dest), person_name, auto_confirm),
        daemon=True,
    )
    thread.start()

    return {
        "story_id": story_id,
        "job_id": job_id,
        "status": "processing",
        "message": "Your story is being transcribed and archived.",
    }


@app.post("/stories/from-transcript")
async def story_from_transcript(
    transcript: str = Form(...),
    person_name: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    vault_id: Optional[str] = Form(None),
    auto_confirm: bool = Form(False),
    user: dict = Depends(_require_user),
):
    """Skip Whisper — useful for demos / paste-in oral transcripts."""
    if not os.getenv("GEMINI_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_KEY is not configured")
    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    vid = _require_vault(user, vault_id, write=True)
    quota = check_story_quota(vid)
    if not quota.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail=quota.get("reason") or "Plan limit reached. Upgrade to continue.",
        )

    story_id = create_story_shell(
        vault_id=vid,
        title=title or person_name or "Pasted oral history",
        contributor_id=user["sub"],
    )
    if not story_id:
        raise HTTPException(status_code=500, detail="Failed to create story")

    job_id = create_processing_job(story_id)
    if not job_id:
        raise HTTPException(status_code=500, detail="Failed to create processing job")

    thread = threading.Thread(
        target=_start_transcript_job,
        args=(story_id, job_id, transcript.strip(), person_name, auto_confirm),
        daemon=True,
    )
    thread.start()

    return {
        "story_id": story_id,
        "job_id": job_id,
        "status": "processing",
        "message": "Your transcript is being turned into a biography and family archive.",
    }


@app.get("/family")
def get_family(
    vault_id: Optional[str] = Query(None),
    viewpoint: Optional[str] = Query(None, description="Person id for kinship viewpoint"),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return get_family_graph(vid, viewpoint_person_id=viewpoint)


@app.post("/family/member")
def create_member(payload: dict, user: dict = Depends(_require_user)):
    vault_id = _require_vault(user, payload.get("vault_id"), write=True)
    member_id = create_family_member_global(
        name=payload.get("name") or "Unknown",
        relationship=payload.get("relationship") or "relative",
        story_id=payload.get("story_id"),
        birth_year=payload.get("birth_year"),
        death_year=payload.get("death_year"),
        notes=payload.get("notes"),
        vault_id=vault_id,
        related_to_person_id=payload.get("related_to_person_id"),
        sex=payload.get("sex"),
    )
    if not member_id:
        raise HTTPException(status_code=500, detail="Failed to create member")
    return {"id": member_id}


@app.post("/family/person")
def create_person_endpoint(payload: dict, user: dict = Depends(_require_user)):
    vault_id = _require_vault(user, payload.get("vault_id"), write=True)
    person_id = create_person(
        name=payload.get("name") or "Unknown",
        vault_id=vault_id,
        birth_year=payload.get("birth_year"),
        death_year=payload.get("death_year"),
        notes=payload.get("notes"),
        birth_place=payload.get("birth_place"),
    )
    if not person_id:
        raise HTTPException(status_code=500, detail="Failed to create person")
    return {"id": person_id}


@app.patch("/family/member/{member_id}")
def update_member(member_id: str, payload: dict, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "person", member_id, write=True)
    ok = update_family_member(
        member_id=member_id,
        name=payload.get("name"),
        relationship=payload.get("relationship"),
        birth_year=payload.get("birth_year"),
        death_year=payload.get("death_year"),
        notes=payload.get("notes"),
        sex=payload.get("sex"),
        set_birth_year="birth_year" in payload,
        set_death_year="death_year" in payload,
        set_sex="sex" in payload,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to update")
    return {"ok": True}


@app.delete("/family/member/{member_id}")
def delete_member(member_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "person", member_id, write=True)
    ok = delete_family_member(member_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete")
    return {"ok": True}


@app.post("/family/relationship")
def add_relationship(payload: dict, user: dict = Depends(_require_user)):
    vault_id = _require_vault(user, payload.get("vault_id"), write=True)
    rel_id = create_relationship(
        from_person_id=payload["from_person_id"],
        to_person_id=payload["to_person_id"],
        rel_type=payload.get("type") or payload.get("relationship") or "relative",
        vault_id=vault_id,
        source_story_id=payload.get("source_story_id"),
        certainty=float(payload.get("certainty") or 1.0),
        notes=payload.get("notes"),
    )
    if not rel_id:
        raise HTTPException(
            status_code=400,
            detail="Only parent, child, spouse, or sibling links can be saved. "
            "Leave uncertain people unattached.",
        )
    return {"id": rel_id}


@app.patch("/family/relationship/{relationship_id}")
def patch_relationship(
    relationship_id: str, payload: dict, user: dict = Depends(_require_user)
):
    _require_entity_vault(user, "relationship", relationship_id, write=True)
    ok = update_relationship(
        relationship_id,
        rel_type=payload.get("type") or payload.get("relationship"),
        notes=payload.get("notes"),
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"ok": True}


@app.delete("/family/relationship/{relationship_id}")
def remove_relationship(relationship_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "relationship", relationship_id, write=True)
    ok = delete_relationship(relationship_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"ok": True}


@app.get("/suggestions")
def suggestions(
    story_id: Optional[str] = None,
    status: str = "pending",
    vault_id: Optional[str] = Query(None),
    user: dict = Depends(_require_user),
):
    vid = _require_vault(user, vault_id)
    return list_suggestions(story_id=story_id, status=status, vault_id=vid)


@app.post("/suggestions/{suggestion_id}/reject")
def suggestion_reject(suggestion_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "suggestion", suggestion_id, write=True)
    if not reject_suggestion(suggestion_id):
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"ok": True}


@app.post("/suggestions/{suggestion_id}/confirm")
def suggestion_confirm(suggestion_id: str, user: dict = Depends(_require_user)):
    _require_entity_vault(user, "suggestion", suggestion_id, write=True)
    if not confirm_suggestion(suggestion_id):
        raise HTTPException(status_code=404, detail="Suggestion not found or already resolved")
    return {"ok": True}
