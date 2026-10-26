import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeInternalPath } from "./safe-next";

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
