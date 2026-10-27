import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOAuthPrefetch,
  loginErrorLocation,
  loginLocationFor,
  oauthCallbackDestination,
  oauthErrorCode,
  pkceFlowId,
  proxySkipsSessionRefresh,
  shouldExchangeOAuthCode,
  signedInEntryRedirect,
} from "./oauth-callback";

function headers(init: Record<string, string> = {}) {
  return new Headers(init);
}

describe("OAuth callback planning", () => {
  it("does not exchange a prefetch or a request that already has a session", () => {
    assert.equal(
      shouldExchangeOAuthCode({ hasCode: true, prefetch: false, hasSession: false }),
      true,
    );
    assert.equal(
      shouldExchangeOAuthCode({ hasCode: true, prefetch: true, hasSession: false }),
      false,
    );
    assert.equal(
      shouldExchangeOAuthCode({ hasCode: true, prefetch: false, hasSession: true }),
      false,
    );
    assert.equal(
      shouldExchangeOAuthCode({ hasCode: false, prefetch: false, hasSession: false }),
      false,
    );
  });

  it("detects prefetch headers from browsers and Next", () => {
    assert.equal(isOAuthPrefetch(headers()), false);
    assert.equal(isOAuthPrefetch(headers({ purpose: "prefetch" })), true);
    assert.equal(isOAuthPrefetch(headers({ "sec-purpose": "prefetch;prerender" })), true);
    assert.equal(isOAuthPrefetch(headers({ "next-router-prefetch": "1" })), true);
    assert.equal(isOAuthPrefetch(headers({ "sec-fetch-dest": "document" })), false);
  });

  it("sends an existing session to next and everyone else toward login", () => {
    assert.equal(
      oauthCallbackDestination({ hasSession: true, next: "/vouchers" }),
      "/vouchers",
    );
    assert.equal(
      oauthCallbackDestination({ hasSession: true, next: "https://evil.example" }),
      "/dashboard",
    );
    assert.equal(
      oauthCallbackDestination({ hasSession: false, next: "/dashboard" }),
      "/login",
    );
  });

  it("forwards a safe provider error and drops control characters", () => {
    assert.equal(
      loginErrorLocation({ error: "access_denied", description: "User cancelled" }),
      "/login?error=access_denied&error_description=User+cancelled",
    );
    assert.equal(
      loginErrorLocation({ error: "bad code", description: "line\nbreak" }),
      "/login?error=google_auth_failed&error_description=line+break",
    );
    assert.equal(
      loginErrorLocation({ error: null, description: null }),
      "/login?error=google_auth_failed",
    );
  });

  it("accepts only a supabase flow id", () => {
    assert.equal(pkceFlowId("abc_DEF-0123"), "abc_DEF-0123");
    assert.equal(pkceFlowId("short"), undefined);
    assert.equal(pkceFlowId("has space"), undefined);
    assert.equal(pkceFlowId(null), undefined);
  });

  it("bounces signed-in users off login and leaves the callback to the route", () => {
    assert.equal(signedInEntryRedirect("/login", "user-1"), "/dashboard");
    assert.equal(signedInEntryRedirect("/signup", "user-1"), "/dashboard");
    assert.equal(signedInEntryRedirect("/login", null), null);
    assert.equal(signedInEntryRedirect("/dashboard", "user-1"), null);
    assert.equal(proxySkipsSessionRefresh("/auth/callback"), true);
    assert.equal(proxySkipsSessionRefresh("/dashboard"), false);
  });

  it("sends a signed-in visitor of /login?next= to that page, never off-site", () => {
    assert.equal(signedInEntryRedirect("/login", "user-1", "/stores"), "/stores");
    assert.equal(signedInEntryRedirect("/login", "user-1", "//evil.example"), "/dashboard");
    assert.equal(signedInEntryRedirect("/login", null, "/stores"), null);
  });

  it("keeps the protected page in next when bouncing to login", () => {
    assert.equal(loginLocationFor("/stores", ""), "/login?next=%2Fstores");
    assert.equal(
      loginLocationFor("/vouchers/abc", "?tab=1"),
      "/login?next=%2Fvouchers%2Fabc%3Ftab%3D1",
    );
    assert.equal(loginLocationFor("/dashboard", ""), "/login");
  });

  it("prefers Supabase's specific error_code over the generic error", () => {
    assert.equal(
      oauthErrorCode(new URLSearchParams("error=access_denied&error_code=otp_expired")),
      "otp_expired",
    );
    assert.equal(oauthErrorCode(new URLSearchParams("error=access_denied")), "access_denied");
    assert.equal(oauthErrorCode(new URLSearchParams("")), null);
  });
});
