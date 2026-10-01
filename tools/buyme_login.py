"""One-time BuyMe login. Saves Playwright storage state locally — never commit it.

Usage (after `pip install playwright && playwright install chromium`):

    python tools/buyme_login.py

Log in manually in the window (including MFA). When you return to the
terminal and press Enter, the script writes:

    .buyme/storage_state.json   browser cookies + localStorage
    .buyme/session_token.txt    Ember JWT only, for the app connector

The app then calls BuyMe's private /siteapi with that token. Later syncs
do not open a browser or retype the password.
"""

from __future__ import annotations

import json
from pathlib import Path


def _extract_token(storage: dict) -> str | None:
    for origin in storage.get("origins", []):
        if "buyme.co.il" not in str(origin.get("origin", "")):
            continue
        for item in origin.get("localStorage", []):
            if item.get("name") != "ember_simple_auth-session":
                continue
            raw = item.get("value") or ""
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                return None
            auth = parsed.get("authenticated") or {}
            token = auth.get("token") or parsed.get("token")
            if isinstance(token, str) and token.count(".") >= 2:
                return token
    return None


def main() -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit(
            "Install Playwright first: pip install playwright && playwright install chromium"
        ) from exc

    out_dir = Path(".buyme")
    out_dir.mkdir(exist_ok=True)
    state_path = out_dir / "storage_state.json"
    token_path = out_dir / "session_token.txt"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://buyme.co.il/")
        input("Log in to BuyMe in the browser, then press Enter here… ")
        context.storage_state(path=str(state_path))
        browser.close()

    storage = json.loads(state_path.read_text(encoding="utf-8"))
    token = _extract_token(storage)
    if not token:
        raise SystemExit("No BuyMe session token in storage state. Log in and retry.")
    token_path.write_text(token, encoding="utf-8")
    print(f"Saved {state_path} and {token_path} (gitignored). Do not commit them.")
    print("Paste the token once into the app connect flow, or POST /api/buyme/session.")


if __name__ == "__main__":
    main()
