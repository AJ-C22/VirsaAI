"""
Local JWT auth for VirsaAI (ship foundation).
Swap to Supabase Auth later — same profiles / vault_members tables.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from typing import Any, Dict, Optional
from uuid import uuid4

from db.db_connection import get_db_connection
from db.db_operations import DEFAULT_VAULT_ID, ensure_default_vault

JWT_SECRET = os.getenv("VIRSA_JWT_SECRET", "dev-only-change-me-before-ship")
TOKEN_TTL_SEC = int(os.getenv("VIRSA_TOKEN_TTL", str(60 * 60 * 24 * 14)))

PLAN_LIMITS = {
    "free": {"story_limit": 5, "member_limit": 3, "label": "Free"},
    "family": {"story_limit": 50, "member_limit": 15, "label": "Family"},
    "legacy": {"story_limit": None, "member_limit": None, "label": "Legacy"},
}


def _b64url(data: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    import base64

    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
    )
    return f"pbkdf2${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt, hexdigest = stored.split("$", 2)
        if algo != "pbkdf2":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
        )
        return hmac.compare_digest(digest.hex(), hexdigest)
    except Exception:
        return False


def issue_token(user_id: str, email: str) -> str:
    import json

    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(
        json.dumps(
            {
                "sub": user_id,
                "email": email,
                "exp": int(time.time()) + TOKEN_TTL_SEC,
                "iat": int(time.time()),
            }
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    sig = _b64url(
        hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    )
    return f"{header}.{payload}.{sig}"


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    import json

    try:
        header_b64, payload_b64, sig = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected = _b64url(
            hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
        )
        if not hmac.compare_digest(expected, sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def register_user(email: str, password: str, display_name: Optional[str] = None) -> Dict:
    email = email.strip().lower()
    if not email or not password or len(password) < 6:
        raise ValueError("Valid email and password (6+ chars) required")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            ensure_default_vault(cur)
            cur.execute("SELECT id FROM profiles WHERE email = %s", (email,))
            if cur.fetchone():
                raise ValueError("An account with this email already exists")

            user_id = str(uuid4())
            cur.execute(
                """
                INSERT INTO profiles (id, email, display_name, password_hash, auth_provider)
                VALUES (%s, %s, %s, %s, 'local')
                """,
                (
                    user_id,
                    email,
                    display_name or email.split("@")[0],
                    hash_password(password),
                ),
            )

            # Personal vault for this family
            vault_name = f"{(display_name or email.split('@')[0]).title()}'s Family Vault"
            limits = PLAN_LIMITS["free"]
            cur.execute(
                """
                INSERT INTO family_vaults (
                    name, description, created_by, plan, plan_status,
                    story_limit, member_limit, cultural_context, kinship_system
                ) VALUES (%s, %s, %s, 'free', 'active', %s, %s, 'punjabi', 'punjabi')
                RETURNING id
                """,
                (
                    vault_name,
                    "Your living family history vault",
                    user_id,
                    limits["story_limit"],
                    limits["member_limit"],
                ),
            )
            vault_id = str(cur.fetchone()[0])
            cur.execute(
                """
                INSERT INTO vault_members (vault_id, user_id, role)
                VALUES (%s, %s, 'owner')
                """,
                (vault_id, user_id),
            )

    token = issue_token(user_id, email)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "display_name": display_name or email.split("@")[0],
        },
        "vault_id": vault_id,
        "onboarding": True,
    }


def login_user(email: str, password: str) -> Dict:
    email = email.strip().lower()
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email, display_name, password_hash
                FROM profiles WHERE email = %s
                """,
                (email,),
            )
            row = cur.fetchone()
            if not row or not row[3] or not verify_password(password, row[3]):
                raise ValueError("Invalid email or password")
            user_id = str(row[0])
            cur.execute(
                """
                SELECT vault_id FROM vault_members
                WHERE user_id = %s
                ORDER BY created_at ASC LIMIT 1
                """,
                (user_id,),
            )
            vault_row = cur.fetchone()
            vault_id = str(vault_row[0]) if vault_row else DEFAULT_VAULT_ID

    return {
        "token": issue_token(user_id, email),
        "user": {
            "id": user_id,
            "email": row[1],
            "display_name": row[2],
        },
        "vault_id": vault_id,
        "onboarding": False,
    }


def get_user_vaults(user_id: str) -> list:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.id, v.name, v.plan, v.plan_status, v.kinship_system,
                       v.story_limit, v.member_limit, vm.role
                FROM vault_members vm
                JOIN family_vaults v ON v.id = vm.vault_id
                WHERE vm.user_id = %s
                ORDER BY vm.created_at
                """,
                (user_id,),
            )
            return [
                {
                    "id": str(r[0]),
                    "name": r[1],
                    "plan": r[2],
                    "plan_status": r[3],
                    "kinship_system": r[4],
                    "story_limit": r[5],
                    "member_limit": r[6],
                    "role": r[7],
                }
                for r in cur.fetchall()
            ]


def create_invite(vault_id: str, email: str, role: str, invited_by: str) -> Dict:
    token = secrets.token_urlsafe(24)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO vault_invites (vault_id, email, role, token, invited_by)
                VALUES (%s, %s, %s::vault_role, %s, %s)
                RETURNING id, token, expires_at
                """,
                (vault_id, email.strip().lower(), role, token, invited_by),
            )
            row = cur.fetchone()
            cur.execute(
                """
                INSERT INTO usage_events (vault_id, user_id, event_type, metadata)
                VALUES (%s, %s, 'invite_sent', %s::jsonb)
                """,
                (vault_id, invited_by, f'{{"email": "{email.strip().lower()}"}}'),
            )
    return {
        "id": str(row[0]),
        "token": row[1],
        "expires_at": row[2],
        "invite_url": f"/invite/{row[1]}",
    }


def accept_invite(token: str, user_id: str) -> str:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, vault_id, role, status, expires_at
                FROM vault_invites WHERE token = %s
                """,
                (token,),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("Invite not found")
            if row[3] != "pending":
                raise ValueError("Invite is no longer valid")
            vault_id = str(row[1])
            cur.execute(
                """
                INSERT INTO vault_members (vault_id, user_id, role)
                VALUES (%s, %s, %s)
                ON CONFLICT (vault_id, user_id) DO NOTHING
                """,
                (vault_id, user_id, row[2]),
            )
            cur.execute(
                """
                UPDATE vault_invites SET status = 'accepted' WHERE id = %s
                """,
                (row[0],),
            )
            return vault_id


def set_vault_plan(vault_id: str, plan: str) -> bool:
    if plan not in PLAN_LIMITS:
        raise ValueError("Unknown plan")
    limits = PLAN_LIMITS[plan]
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE family_vaults
                SET plan = %s, plan_status = 'active',
                    story_limit = %s, member_limit = %s
                WHERE id = %s
                """,
                (plan, limits["story_limit"], limits["member_limit"], vault_id),
            )
            return cur.rowcount > 0


def check_story_quota(vault_id: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT plan, story_limit FROM family_vaults WHERE id = %s",
                (vault_id,),
            )
            row = cur.fetchone()
            if not row:
                return {"allowed": False, "reason": "Vault not found"}
            plan, limit = row[0], row[1]
            cur.execute(
                """
                SELECT COUNT(*) FROM stories
                WHERE vault_id = %s AND status = 'ready'
                """,
                (vault_id,),
            )
            used = cur.fetchone()[0]
            if limit is not None and used >= limit:
                return {
                    "allowed": False,
                    "reason": f"{plan} plan limit reached ({used}/{limit} stories)",
                    "used": used,
                    "limit": limit,
                    "plan": plan,
                }
            return {
                "allowed": True,
                "used": used,
                "limit": limit,
                "plan": plan,
            }


def vault_dashboard_stats(vault_id: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT name, plan, plan_status, kinship_system, story_limit, member_limit
                FROM family_vaults WHERE id = %s
                """,
                (vault_id,),
            )
            v = cur.fetchone()
            if not v:
                raise ValueError("Vault not found")

            def count(sql: str) -> int:
                cur.execute(sql, (vault_id,))
                return cur.fetchone()[0]

            stories = count(
                "SELECT COUNT(*) FROM stories WHERE vault_id = %s AND status = 'ready'"
            )
            people = count("SELECT COUNT(*) FROM persons WHERE vault_id = %s")
            events = count(
                "SELECT COUNT(*) FROM timeline_events WHERE vault_id = %s AND status = 'confirmed'"
            )
            artifacts = count("SELECT COUNT(*) FROM artifacts WHERE vault_id = %s")
            shared = count("SELECT COUNT(*) FROM shared_memories WHERE vault_id = %s")
            members = count("SELECT COUNT(*) FROM vault_members WHERE vault_id = %s")

            cur.execute(
                """
                SELECT id, title, summary, updated_at, status
                FROM stories WHERE vault_id = %s
                ORDER BY updated_at DESC NULLS LAST LIMIT 5
                """,
                (vault_id,),
            )
            recent_stories = [
                {
                    "id": str(r[0]),
                    "title": r[1],
                    "summary": r[2],
                    "updated_at": r[3],
                    "status": r[4],
                }
                for r in cur.fetchall()
            ]

            cur.execute(
                """
                SELECT year, title, person_id FROM timeline_events
                WHERE vault_id = %s AND status = 'confirmed' AND year IS NOT NULL
                ORDER BY year DESC LIMIT 8
                """,
                (vault_id,),
            )
            recent_events = [
                {"year": r[0], "title": r[1], "person_id": str(r[2])}
                for r in cur.fetchall()
            ]

    quota = check_story_quota(vault_id)
    return {
        "vault": {
            "id": vault_id,
            "name": v[0],
            "plan": v[1],
            "plan_status": v[2],
            "kinship_system": v[3],
            "story_limit": v[4],
            "member_limit": v[5],
        },
        "counts": {
            "stories": stories,
            "people": people,
            "events": events,
            "artifacts": artifacts,
            "shared_memories": shared,
            "members": members,
        },
        "quota": quota,
        "recent_stories": recent_stories,
        "recent_events": recent_events,
        "plans": PLAN_LIMITS,
    }
