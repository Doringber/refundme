import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReauthenticationRequired, UpstreamError } from "./errors";
import { createBuyMeSession } from "./session";
import { BUYME_ORIGIN, BuyMeTransport } from "./transport";

function fakeJwt(expSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expSec })).toString("base64url");
  return `${header}.${payload}.sig`;
}

describe("BuyMeTransport", () => {
  it("allowlists buyme.co.il only", async () => {
    const transport = new BuyMeTransport({
      session: createBuyMeSession(fakeJwt(Math.floor(Date.now() / 1000) + 3600)),
      fetch: async () => new Response("{}", { status: 200 }),
    });
    await assert.rejects(
      () => transport.request("https://evil.example/siteapi/x"),
      (err: unknown) => err instanceof UpstreamError && err.code === "UNSUPPORTED_ORIGIN",
    );
  });

  it("sends Bearer token and maps 401 to reauth", async () => {
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
    let sawAuth = "";
    const transport = new BuyMeTransport({
      session: createBuyMeSession(token),
      fetch: async (_url, init) => {
        sawAuth = new Headers(init?.headers).get("authorization") ?? "";
        return new Response("nope", { status: 401 });
      },
    });
    await assert.rejects(
      () => transport.request("/siteapi/vouchers/received?page=1&perPage=50&isUsed=0&isExpired=0"),
      (err: unknown) => err instanceof ReauthenticationRequired,
    );
    assert.equal(sawAuth, `Bearer ${token}`);
    assert.equal(transport.session, null);
  });

  it("uses BUYME_ORIGIN as base", () => {
    assert.equal(BUYME_ORIGIN, "https://buyme.co.il");
  });
});
