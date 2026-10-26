import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOwnedDocumentPath,
  safeDocumentFileName,
  voucherDocumentObjectPath,
} from "./object-path";

const userId = "11111111-1111-1111-1111-111111111111";
const voucherId = "22222222-2222-2222-2222-222222222222";

describe("voucher object paths", () => {
  it("strips directory traversal from file names", () => {
    assert.equal(safeDocumentFileName("../../other/secret.pdf"), "secret.pdf");
    assert.equal(
      voucherDocumentObjectPath(userId, voucherId, "..\\..\\secret.pdf"),
      `${userId}/${voucherId}/secret.pdf`,
    );
  });

  it("rejects ids that are not a single path segment", () => {
    assert.throws(
      () => voucherDocumentObjectPath("../other", voucherId, "a.jpg"),
      /INVALID_STORAGE_ID/,
    );
  });

  it("only accepts paths under the owner prefix", () => {
    const path = voucherDocumentObjectPath(userId, voucherId, "credit.jpg");
    assert.equal(isOwnedDocumentPath(userId, path), true);
    assert.equal(isOwnedDocumentPath(userId, `${userId}/../secret`), false);
    assert.equal(
      isOwnedDocumentPath(userId, "33333333-3333-3333-3333-333333333333/x/a.jpg"),
      false,
    );
  });
});
