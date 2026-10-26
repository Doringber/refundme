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
  url: "https://buyme.co.il/giftcard/abc",
  shortToken: "abc-token",
  supplierDescription: "Fox description",
  redemptionInstructions: "Show at checkout",
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
    assert.equal(item.url, "https://buyme.co.il/giftcard/abc");
    assert.equal(item.shortToken, "abc-token");
    assert.equal(item.supplierDescription, "Fox description");
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
    assert.equal(
      fresh.inserts[0].extraction_raw.url,
      "https://buyme.co.il/giftcard/abc",
    );
    assert.equal(fresh.inserts[0].extraction_raw.shortToken, "abc-token");
  });

  it("keeps a stored code and BuyMe link when a later sync omits them", () => {
    const item = normalizeBuyMeCard({
      ...card,
      code: null,
      barcode: null,
      url: null,
      shortToken: null,
      supplierDescription: null,
      redemptionInstructions: null,
    });
    const plan = planBuyMeUpserts(
      [
        {
          id: "row-1",
          externalId: "42",
          voucherCode: "KEEP",
          barcodeValue: "111",
          url: "https://buyme.co.il/giftcard/keep",
          shortToken: "tok",
          supplierName: "Fox",
          supplierDescription: "keep-desc",
          redemptionInstructions: "keep-steps",
        },
      ],
      [item],
    );
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].voucher_code, "KEEP");
    assert.equal(plan.updates[0].barcode_value, "111");
    assert.equal(plan.updates[0].extraction_raw.url, "https://buyme.co.il/giftcard/keep");
    assert.equal(plan.updates[0].extraction_raw.shortToken, "tok");
    assert.equal(plan.updates[0].extraction_raw.supplierDescription, "keep-desc");
    assert.equal(plan.updates[0].extraction_raw.redemptionInstructions, "keep-steps");
  });

  it("does not plan duplicate inserts from repeated wallet rows", () => {
    const item = normalizeBuyMeCard(card);
    const plan = planBuyMeUpserts([], [item, item]);
    assert.equal(plan.inserts.length, 1);
    assert.equal(plan.updates.length, 0);
  });

  it("round-trips a session token without storing it in plaintext", () => {
    const secret = "test-session-key";
    const token = ["aaa", "bbb", "ccc"].join(".");
    const cipher = encryptSessionToken(token, secret);
    assert.equal(cipher.includes(token), false);
    assert.equal(decryptSessionToken(cipher, secret), token);
  });
});
