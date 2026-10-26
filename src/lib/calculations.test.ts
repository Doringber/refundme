import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDashboardSummary,
  daysUntil,
  expiryMessage,
  expiryUrgency,
  isSpendable,
  remainingFromRedemptions,
} from "./calculations";
import { createDemoSeed } from "./demo/data";
import type { Voucher } from "./types";

const today = new Date("2026-03-28T12:00:00Z");

function baseVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "t1",
    userId: "u1",
    merchantId: null,
    merchantName: "FOX",
    documentType: "store_credit",
    status: "active",
    originalAmountAgorot: 12000,
    remainingAmountAgorot: 12000,
    currency: "ILS",
    issueDate: "2026-03-01",
    expiryDate: "2026-04-09",
    expiryConfidence: "confirmed",
    voucherCode: null,
    barcodeValue: null,
    usageTerms: null,
    notes: null,
    documentPath: null,
    documentMimeType: null,
    documentFileName: null,
    documentDataUrl: null,
    extractionRaw: null,
    fieldsConfirmed: true,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("credit calculations", () => {
  it("recalculates remaining from redemptions", () => {
    assert.equal(remainingFromRedemptions(20000, 8000), 12000);
    assert.equal(remainingFromRedemptions(20000, 20000), 0);
    assert.equal(remainingFromRedemptions(20000, 25000), 0);
  });

  it("does not count receipts as spendable credit", () => {
    const receipt = baseVoucher({
      documentType: "receipt",
      status: "archived",
      remainingAmountAgorot: 45900,
    });
    assert.equal(isSpendable(receipt), false);
    const summary = buildDashboardSummary([receipt], [], today);
    assert.equal(summary.totalActiveCreditAgorot, 0);
  });

  it("does not invent countdown without confirmed expiry", () => {
    const v = baseVoucher({
      expiryDate: null,
      expiryConfidence: "missing",
    });
    assert.equal(expiryUrgency(v.expiryDate, v.expiryConfidence, today), "none");
    const summary = buildDashboardSummary([v], [], today);
    assert.equal(summary.daysUntilNearestExpiry, null);
    assert.match(expiryMessage(v, null), /תוקף לא אומת/);
  });

  it("marks urgent expiry within 7 days", () => {
    const v = baseVoucher({ expiryDate: "2026-04-02" });
    assert.equal(daysUntil("2026-04-02", today), 5);
    assert.equal(expiryUrgency(v.expiryDate, "confirmed", today), "urgent");
  });

  it("demo seed totals exclude receipt and include partial redemption", () => {
    const seed = createDemoSeed();
    const summary = buildDashboardSummary(seed.vouchers, seed.activity, today);
    // Shufersal 19.90 + Super-Pharm 35.20 + FOX 280 + Zara 120 + BuyMe FOODY 200 = 655.10; receipt excluded
    assert.equal(summary.totalActiveCreditAgorot, 65510);
    assert.ok(summary.nearestExpiring);
    assert.equal(summary.nearestExpiring?.merchantName, "זארה");
  });
});

