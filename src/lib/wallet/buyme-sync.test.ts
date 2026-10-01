import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeBuyMeCard } from "./buyme-provider";
import { decryptSessionToken, encryptSessionToken } from "./session-crypto";
import { planBuyMeUpserts } from "./upsert-plan";
import type { BuyMeWalletCard } from "@/lib/buyme/wallet";

const card: BuyMeWalletCard = {
  id: 42,
  title: "FOX",
  balanceShekels: 187.5,
  originalValueShekels: 300,
  code: "ABC",
  barcode: "729",
  expiresAt: "2027-01-15T00:00:00.000Z",
  used: false,
  supplierName: "Fox",
  url: null,
};

describe("BuyMe wallet sync", () => {
  it("normalizes a wallet card into the shared item shape", () => {
    const item = normalizeBuyMeCard(card);
    assert.equal(item.provider, "buyme");
    assert.equal(item.externalId, "42");
    assert.equal(item.merchant, "FOX");
    assert.equal(item.originalValueShekels, 300);
    assert.equal(item.remainingValueShekels, 187.5);
    assert.equal(item.expiresAt, "2027-01-15");
    assert.equal(item.status, "active");
  });

  it("plans insert vs update by external id", () => {
    const item = normalizeBuyMeCard(card);
    const plan = planBuyMeUpserts([{ id: "row-1", externalId: "42" }], [item]);
    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].id, "row-1");
    assert.equal(plan.updates[0].remaining_amount_agorot, 18750);
    const fresh = planBuyMeUpserts([], [item]);
    assert.equal(fresh.inserts.length, 1);
    assert.equal(fresh.inserts[0].extraction_raw.externalId, "42");
  });

  it("round-trips a session token without storing it in plaintext", () => {
    const secret = "test-session-key";
    const token = ["aaa", "bbb", "ccc"].join(".");
    const cipher = encryptSessionToken(token, secret);
    assert.equal(cipher.includes(token), false);
    assert.equal(decryptSessionToken(cipher, secret), token);
  });
});
