"""
Stripe Checkout + Customer Portal for Virsa vault plans.
Env:
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_FAMILY   (price_...)
  STRIPE_PRICE_LEGACY   (price_...)
  APP_URL / FRONTEND_URL  (default http://127.0.0.1:3000)
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import stripe

from auth import PLAN_LIMITS, set_vault_plan
from db.db_connection import get_db_connection

stripe.api_key = os.getenv("STRIPE_SECRET_KEY") or None

APP_URL = (
    os.getenv("APP_URL")
    or os.getenv("FRONTEND_URL")
    or "http://127.0.0.1:3000"
).rstrip("/")

PRICE_TO_PLAN = {
    (os.getenv("STRIPE_PRICE_FAMILY") or "").strip(): "family",
    (os.getenv("STRIPE_PRICE_LEGACY") or "").strip(): "legacy",
}
# drop empty keys
PRICE_TO_PLAN = {k: v for k, v in PRICE_TO_PLAN.items() if k}

PLAN_TO_PRICE = {
    "family": os.getenv("STRIPE_PRICE_FAMILY") or "",
    "legacy": os.getenv("STRIPE_PRICE_LEGACY") or "",
}


def stripe_configured() -> bool:
    return bool(
        stripe.api_key
        and PLAN_TO_PRICE.get("family")
        and PLAN_TO_PRICE.get("legacy")
    )


def _assert_vault_member(user_id: str, vault_id: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT role FROM vault_members
                WHERE vault_id = %s AND user_id = %s
                """,
                (vault_id, user_id),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("You are not a member of this vault")


def _vault_billing_row(vault_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, plan, stripe_customer_id, stripe_subscription_id
                FROM family_vaults WHERE id = %s
                """,
                (vault_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "name": row[1],
                "plan": row[2],
                "stripe_customer_id": row[3],
                "stripe_subscription_id": row[4],
            }


def _save_stripe_ids(
    vault_id: str,
    *,
    customer_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if customer_id and subscription_id:
                cur.execute(
                    """
                    UPDATE family_vaults
                    SET stripe_customer_id = COALESCE(%s, stripe_customer_id),
                        stripe_subscription_id = COALESCE(%s, stripe_subscription_id)
                    WHERE id = %s
                    """,
                    (customer_id, subscription_id, vault_id),
                )
            elif customer_id:
                cur.execute(
                    """
                    UPDATE family_vaults
                    SET stripe_customer_id = %s
                    WHERE id = %s
                    """,
                    (customer_id, vault_id),
                )
            elif subscription_id:
                cur.execute(
                    """
                    UPDATE family_vaults
                    SET stripe_subscription_id = %s
                    WHERE id = %s
                    """,
                    (subscription_id, vault_id),
                )


def apply_plan_from_subscription(
    vault_id: str,
    plan: str,
    *,
    customer_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
    status: str = "active",
) -> None:
    if plan not in PLAN_LIMITS:
        raise ValueError(f"Unknown plan: {plan}")
    limits = PLAN_LIMITS[plan]
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE family_vaults
                SET plan = %s,
                    plan_status = %s,
                    story_limit = %s,
                    member_limit = %s,
                    stripe_customer_id = COALESCE(%s, stripe_customer_id),
                    stripe_subscription_id = COALESCE(%s, stripe_subscription_id)
                WHERE id = %s
                """,
                (
                    plan,
                    status,
                    limits["story_limit"],
                    limits["member_limit"],
                    customer_id,
                    subscription_id,
                    vault_id,
                ),
            )


def _plan_from_subscription(subscription: Any) -> Optional[str]:
    items = (subscription.get("items") or {}).get("data") or []
    if not items and hasattr(subscription, "items"):
        items = subscription["items"]["data"]
    for item in items:
        price = item.get("price") if isinstance(item, dict) else item.price
        price_id = price.get("id") if isinstance(price, dict) else getattr(price, "id", None)
        if price_id and price_id in PRICE_TO_PLAN:
            return PRICE_TO_PLAN[price_id]
    return None


def create_checkout_session(
    *,
    vault_id: str,
    plan: str,
    user_id: str,
    email: str,
) -> Dict[str, str]:
    if plan == "free":
        set_vault_plan(vault_id, "free")
        return {"mode": "free", "url": f"{APP_URL}/dashboard"}

    if not stripe_configured():
        raise ValueError(
            "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* env vars."
        )
    if plan not in ("family", "legacy"):
        raise ValueError("Checkout is only for Family or Legacy plans")

    _assert_vault_member(user_id, vault_id)
    vault = _vault_billing_row(vault_id)
    if not vault:
        raise ValueError("Vault not found")

    price_id = PLAN_TO_PRICE[plan]
    customer_id = vault.get("stripe_customer_id")

    params: Dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": f"{APP_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{APP_URL}/pricing?checkout=cancelled",
        "client_reference_id": vault_id,
        "metadata": {
            "vault_id": vault_id,
            "plan": plan,
            "user_id": user_id,
        },
        "subscription_data": {
            "metadata": {
                "vault_id": vault_id,
                "plan": plan,
            }
        },
        "allow_promotion_codes": True,
    }
    if customer_id:
        params["customer"] = customer_id
    else:
        params["customer_email"] = email

    session = stripe.checkout.Session.create(**params)
    return {"mode": "checkout", "url": session.url, "session_id": session.id}


def create_portal_session(*, vault_id: str, user_id: str) -> Dict[str, str]:
    if not stripe_configured():
        raise ValueError("Stripe is not configured")
    _assert_vault_member(user_id, vault_id)
    vault = _vault_billing_row(vault_id)
    if not vault or not vault.get("stripe_customer_id"):
        raise ValueError("No Stripe customer on this vault yet — upgrade first")
    session = stripe.billing_portal.Session.create(
        customer=vault["stripe_customer_id"],
        return_url=f"{APP_URL}/pricing",
    )
    return {"url": session.url}


def sync_checkout_session(session_id: str) -> Dict[str, Any]:
    """Confirm success page: pull session and apply plan if webhook lagged."""
    if not stripe.api_key:
        raise ValueError("Stripe is not configured")
    session = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
    vault_id = (session.metadata or {}).get("vault_id") or session.client_reference_id
    if not vault_id:
        raise ValueError("Checkout session missing vault")
    plan = (session.metadata or {}).get("plan")
    sub = session.subscription
    customer_id = session.customer
    subscription_id = sub if isinstance(sub, str) else (sub.id if sub else None)
    if not plan and sub and not isinstance(sub, str):
        plan = _plan_from_subscription(sub)
    if not plan:
        plan = "family"
    if session.payment_status in ("paid", "no_payment_required") or session.status == "complete":
        apply_plan_from_subscription(
            vault_id,
            plan,
            customer_id=str(customer_id) if customer_id else None,
            subscription_id=str(subscription_id) if subscription_id else None,
            status="active",
        )
    return {"vault_id": vault_id, "plan": plan, "status": "active"}


def handle_webhook(payload: bytes, sig_header: str) -> Dict[str, str]:
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise ValueError("STRIPE_WEBHOOK_SECRET is not set")
    event = stripe.Webhook.construct_event(payload, sig_header, secret)
    etype = event["type"]
    data = event["data"]["object"]

    if etype == "checkout.session.completed":
        vault_id = (data.get("metadata") or {}).get("vault_id") or data.get(
            "client_reference_id"
        )
        plan = (data.get("metadata") or {}).get("plan")
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        if vault_id and plan:
            apply_plan_from_subscription(
                vault_id,
                plan,
                customer_id=customer_id,
                subscription_id=subscription_id,
                status="active",
            )
        return {"handled": etype}

    if etype in ("customer.subscription.updated", "customer.subscription.created"):
        vault_id = (data.get("metadata") or {}).get("vault_id")
        plan = (data.get("metadata") or {}).get("plan") or _plan_from_subscription(data)
        status_map = {
            "active": "active",
            "trialing": "active",
            "past_due": "past_due",
            "canceled": "canceled",
            "unpaid": "past_due",
            "incomplete": "incomplete",
        }
        stripe_status = data.get("status") or "active"
        plan_status = status_map.get(stripe_status, stripe_status)
        if vault_id and plan:
            if stripe_status in ("canceled", "unpaid") and stripe_status == "canceled":
                apply_plan_from_subscription(
                    vault_id,
                    "free",
                    customer_id=data.get("customer"),
                    subscription_id=data.get("id"),
                    status="canceled",
                )
            else:
                apply_plan_from_subscription(
                    vault_id,
                    plan,
                    customer_id=data.get("customer"),
                    subscription_id=data.get("id"),
                    status=plan_status,
                )
                _save_stripe_ids(
                    vault_id,
                    customer_id=data.get("customer"),
                    subscription_id=data.get("id"),
                )
        return {"handled": etype}

    if etype == "customer.subscription.deleted":
        vault_id = (data.get("metadata") or {}).get("vault_id")
        if vault_id:
            apply_plan_from_subscription(
                vault_id,
                "free",
                customer_id=data.get("customer"),
                subscription_id=None,
                status="canceled",
            )
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE family_vaults
                        SET stripe_subscription_id = NULL
                        WHERE id = %s
                        """,
                        (vault_id,),
                    )
        return {"handled": etype}

    return {"handled": "ignored", "type": etype}
