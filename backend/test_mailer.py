"""Invite mail logs the letter when no provider is configured."""
import os
from pathlib import Path

from mailer import mail_config, send_invite_email


def test_unconfigured_mail_is_logged(tmp_path=None):
    path = Path(tmp_path or Path("/tmp")) / "virsa-mail-test.log"
    if path.exists():
        path.unlink()
    os.environ.pop("SMTP_HOST", None)
    os.environ.pop("RESEND_API_KEY", None)
    os.environ["MAIL_LOG_PATH"] = str(path)
    assert mail_config()["configured"] is False
    result = send_invite_email(
        "aunt@example.com",
        "http://127.0.0.1:3000/invite/abc",
        "The Singh vault",
        "editor",
    )
    assert result["delivered"] is False
    assert result["provider"] == "log"
    text = path.read_text()
    assert "aunt@example.com" in text
    assert "/invite/abc" in text
    path.unlink()


if __name__ == "__main__":
    test_unconfigured_mail_is_logged()
    print("ok mailer")
