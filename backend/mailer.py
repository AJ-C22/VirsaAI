"""
Invite mail. SMTP or Resend when configured; otherwise the letter is logged
so the invite still exists and the link can be copied.
"""
from __future__ import annotations

import json
import os
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

_BACKEND_DIR = Path(__file__).resolve().parent


def mail_config() -> dict:
    if (os.getenv("SMTP_HOST") or "").strip():
        return {"configured": True, "provider": "smtp"}
    if (os.getenv("RESEND_API_KEY") or "").strip():
        return {"configured": True, "provider": "resend"}
    return {"configured": False, "provider": "log"}


def _log_path() -> Path:
    raw = (os.getenv("MAIL_LOG_PATH") or "").strip()
    path = Path(raw) if raw else _BACKEND_DIR / "logs" / "mail.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _send_smtp(to: str, subject: str, text: str) -> None:
    host = os.environ["SMTP_HOST"].strip()
    port = int(os.getenv("SMTP_PORT") or "587")
    username = (os.getenv("SMTP_USER") or "").strip()
    password = os.getenv("SMTP_PASSWORD") or ""
    sender = (os.getenv("MAIL_FROM") or username or "noreply@virsa.local").strip()
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if port != 25:
            smtp.starttls()
        if username:
            smtp.login(username, password)
        smtp.send_message(message)


def _send_resend(to: str, subject: str, text: str) -> None:
    sender = (os.getenv("MAIL_FROM") or "Virsa <noreply@virsa.ai>").strip()
    body = json.dumps(
        {"from": sender, "to": [to], "subject": subject, "text": text}
    ).encode()
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": f"Bearer {os.environ['RESEND_API_KEY'].strip()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status >= 300:
            raise RuntimeError(f"Resend returned {response.status}")


def send_email(to: str, subject: str, text: str) -> dict:
    """Send one letter. Failure is reported, never raised to the caller."""
    config = mail_config()
    try:
        if config["provider"] == "smtp":
            _send_smtp(to, subject, text)
            return {"delivered": True, "provider": "smtp"}
        if config["provider"] == "resend":
            _send_resend(to, subject, text)
            return {"delivered": True, "provider": "resend"}
        line = json.dumps({"to": to, "subject": subject, "text": text})
        with _log_path().open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
        return {"delivered": False, "provider": "log"}
    except (OSError, smtplib.SMTPException, urllib.error.URLError, RuntimeError) as exc:
        return {"delivered": False, "provider": config["provider"], "error": str(exc)}


def send_invite_email(
    to: str,
    invite_url: str,
    vault_name: str,
    role: str,
) -> dict:
    subject = f"You are invited to {vault_name} on Virsa"
    text = (
        f"You have been invited to the {vault_name} family vault as {role}.\n\n"
        f"Open this link to join:\n{invite_url}\n\n"
        "Use the same email address this invitation was sent to."
    )
    return send_email(to, subject, text)
