import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInviteToken, hashInviteToken, isInviteToken } from "./tokens";

describe("household invite tokens", () => {
  it("stores a sha256 hex digest, not the link secret", () => {
    const token = createInviteToken();
    const again = createInviteToken();
    assert.equal(isInviteToken(token), true);
    assert.notEqual(token, again);
    const hash = hashInviteToken(token);
    assert.equal(hash, hashInviteToken(token));
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash.includes(token), false);
    assert.notEqual(hash, hashInviteToken(again));
  });
});
