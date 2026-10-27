import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("maps Supabase error codes to Hebrew", () => {
    assert.equal(
      authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }),
      "האימייל או הסיסמה לא נכונים.",
    );
    assert.match(authErrorMessage({ code: "email_not_confirmed" }), /לאשר את האימייל/);
    assert.match(authErrorMessage({ code: "user_already_exists" }), /כבר יש חשבון/);
    assert.match(authErrorMessage({ code: "weak_password" }), /חלשה/);
  });

  it("falls back to the English message when an older server sends no code", () => {
    assert.equal(
      authErrorMessage({ message: "Invalid login credentials" }),
      "האימייל או הסיסמה לא נכונים.",
    );
    assert.match(authErrorMessage({ message: "User already registered" }), /כבר יש חשבון/);
    assert.match(
      authErrorMessage({ message: "Password should be at least 6 characters." }),
      /חלשה/,
    );
  });

  it("reports network and rate-limit failures without English text", () => {
    assert.match(authErrorMessage({ name: "AuthRetryableFetchError", message: "Failed to fetch" }), /אין חיבור/);
    assert.match(authErrorMessage({ status: 429, message: "Too Many Requests" }), /יותר מדי/);
    assert.equal(authErrorMessage({ message: "Something odd" }), "ההתחברות נכשלה. נסו שוב.");
    assert.equal(authErrorMessage(null, "ההרשמה נכשלה."), "ההרשמה נכשלה.");
  });
});
