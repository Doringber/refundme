import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { oauthErrorMessage } from "./oauth-errors";

describe("oauthErrorMessage", () => {
  it("prefers a known Hebrew message over the provider description", () => {
    assert.equal(
      oauthErrorMessage("access_denied", "The user cancelled"),
      "ההתחברות עם Google בוטלה.",
    );
    assert.equal(
      oauthErrorMessage("google_auth_failed", null),
      "התחברות עם Google נכשלה. נסו שוב או השתמשו באימייל.",
    );
  });

  it("shows a sanitized description for an unknown code inside a Hebrew message", () => {
    assert.equal(
      oauthErrorMessage("invalid_request", "temporarily unavailable"),
      "ההתחברות נכשלה (temporarily unavailable). נסו שוב.",
    );
    assert.equal(
      oauthErrorMessage(null, "line\nbreak"),
      "ההתחברות נכשלה (line break). נסו שוב.",
    );
    assert.equal(oauthErrorMessage("invalid_request", null), "ההתחברות נכשלה. נסו שוב.");
    assert.equal(oauthErrorMessage(null, null), null);
  });

  it("does not echo crafted links, markup or phone numbers from the URL", () => {
    const generic = "ההתחברות נכשלה. נסו שוב.";
    assert.equal(oauthErrorMessage("x", "<script>alert(1)</script>"), generic);
    assert.equal(oauthErrorMessage("x", "Account locked, visit evil.com now"), generic);
    assert.equal(oauthErrorMessage("x", "Call support 0501234567"), generic);
    assert.equal(oauthErrorMessage(null, "החשבון נחסם, התקשרו"), generic);
  });

  it("explains provider and session-state failures in Hebrew", () => {
    assert.equal(
      oauthErrorMessage("server_error", "Unable to exchange external code"),
      "שרת ההתחברות לא הגיב. נסו שוב בעוד רגע.",
    );
    assert.match(oauthErrorMessage("otp_expired", "Email link is invalid or has expired")!, /פג תוקף/);
    assert.match(oauthErrorMessage("bad_oauth_state", null)!, /בדפדפן אחר/);
  });
});