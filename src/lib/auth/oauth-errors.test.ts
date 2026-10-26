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

  it("shows a sanitized description for an unknown code", () => {
    assert.equal(
      oauthErrorMessage("server_error", "temporarily unavailable"),
      "temporarily unavailable",
    );
    assert.equal(oauthErrorMessage(null, null), null);
  });
});