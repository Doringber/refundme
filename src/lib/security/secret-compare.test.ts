import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { secretsMatch } from "./secret-compare";

describe("secretsMatch", () => {
  it("matches equal secrets and rejects everything else", () => {
    assert.equal(secretsMatch("cron-secret", "cron-secret"), true);
    assert.equal(secretsMatch("cron-secret", "cron-secret "), false);
    assert.equal(secretsMatch("cron-secret", "other"), false);
    assert.equal(secretsMatch(undefined, "cron-secret"), false);
    assert.equal(secretsMatch("cron-secret", null), false);
    assert.equal(secretsMatch("", "cron-secret"), false);
  });
});
