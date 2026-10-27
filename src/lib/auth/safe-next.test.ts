import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { googleRedirectTo, safeInternalPath } from "./safe-next";

describe("safeInternalPath", () => {
  it("keeps in-app paths", () => {
    assert.equal(safeInternalPath("/dashboard"), "/dashboard");
    assert.equal(
      safeInternalPath("/vouchers/abc?tab=1#code"),
      "/vouchers/abc?tab=1#code",
    );
  });

  it("rejects off-site and protocol-relative targets", () => {
    assert.equal(safeInternalPath("https://evil.example/phish"), "/dashboard");
    assert.equal(safeInternalPath("//evil.example"), "/dashboard");
    assert.equal(safeInternalPath("/\\evil.example"), "/dashboard");
    assert.equal(safeInternalPath("/%2f%2fevil.example"), "/dashboard");
    assert.equal(
      safeInternalPath("/%0d%0aLocation:%20https://evil.example"),
      "/dashboard",
    );
    assert.equal(safeInternalPath(null), "/dashboard");
  });
});

describe("googleRedirectTo", () => {
  it("returns to this origin's callback with a safe next", () => {
    assert.equal(
      googleRedirectTo("https://justrefundme.netlify.app", "/stores?x=1"),
      "https://justrefundme.netlify.app/auth/callback?next=%2Fstores%3Fx%3D1",
    );
    assert.equal(
      googleRedirectTo("http://localhost:3000/", "https://evil.example"),
      "http://localhost:3000/auth/callback?next=%2Fdashboard",
    );
    assert.equal(
      googleRedirectTo("https://deploy-preview-28--justrefundme.netlify.app", null),
      "https://deploy-preview-28--justrefundme.netlify.app/auth/callback?next=%2Fdashboard",
    );
  });
});
