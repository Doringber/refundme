import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { siteOrigin } from "./site-origin";

describe("siteOrigin", () => {
  it("keeps an http(s) origin and otherwise uses the fallback", () => {
    assert.equal(
      siteOrigin("https://justrefundme.netlify.app/path", "https://fallback.example"),
      "https://justrefundme.netlify.app",
    );
    assert.equal(siteOrigin("javascript:alert(1)", "https://fallback.example"), "https://fallback.example");
    assert.equal(siteOrigin("", "https://fallback.example"), "https://fallback.example");
  });
});
