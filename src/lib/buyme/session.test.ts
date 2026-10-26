import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createBuyMeSession,
  decodeJwtExpMs,
  isSessionExpired,
} from "./session";

describe("BuyMeSession", () => {
  it("decodes JWT exp", () => {
    const exp = Math.floor(Date.now() / 1000) + 7200;
    // Build JWT parts at runtime — never commit a literal `eyJ...` string
    // (GitGuardian flags those as Generic High Entropy Secret).
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
      "base64url",
    );
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    const token = `${header}.${payload}.sig`;
    const ms = decodeJwtExpMs(token);
    assert.ok(ms != null);
    assert.equal(ms, exp * 1000);
    const session = createBuyMeSession(token);
    assert.equal(isSessionExpired(session), false);
    assert.equal(isSessionExpired(session, exp * 1000 + 1), true);
  });

  it("rejects oversized tokens before they are stored in a cookie", () => {
    const huge = `aaaa.${"b".repeat(4000)}.sig`;
    assert.throws(() => createBuyMeSession(huge), /INVALID_BUYME_TOKEN/);
  });
});
