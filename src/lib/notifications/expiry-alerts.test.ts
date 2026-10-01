import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectExpiryAlerts,
  matchingReminderThreshold,
} from "./expiry-alerts";
import type { Voucher } from "../types";

function sampleVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "v-1",
    userId: "u-1",
    merchantId: null,
    merchantName: "FOX",
    documentType: "store_credit",
    status: "active",
    originalAmountAgorot: 10000,
    remainingAmountAgorot: 10000,
    currency: "ILS",
    issueDate: "2026-01-01",
    expiryDate: "2026-04-08",
    expiryConfidence: "confirmed",
    voucherCode: "ABC123",
    barcodeValue: null,
    usageTerms: null,
    notes: null,
    documentPath: null,
    documentMimeType: null,
    documentFileName: null,
    documentDataUrl: null,
    extractionRaw: null,
    fieldsConfirmed: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("expiry browser alerts", () => {
  it("matches the tightest reminder threshold", () => {
    assert.equal(matchingReminderThreshold(14, [30, 14, 7, 3, 1]), 14);
    assert.equal(matchingReminderThreshold(7, [30, 14, 7, 3, 1]), 7);
    assert.equal(matchingReminderThreshold(2, [30, 14, 7, 3, 1]), 3);
    assert.equal(matchingReminderThreshold(0, [30, 14, 7, 3, 1]), 0);
    assert.equal(matchingReminderThreshold(-2, [30, 14, 7, 3, 1]), 0);
    assert.equal(matchingReminderThreshold(45, [30, 14, 7, 3, 1]), null);
  });

  it("collects only confirmed spendable vouchers in window", () => {
    const today = new Date("2026-04-01T12:00:00");
    const alerts = collectExpiryAlerts(
      [
        sampleVoucher({ id: "soon", expiryDate: "2026-04-08" }), // 7 days
        sampleVoucher({
          id: "far",
          expiryDate: "2026-06-01",
        }),
        sampleVoucher({
          id: "unconfirmed",
          expiryDate: "2026-04-05",
          expiryConfidence: "uncertain",
        }),
        sampleVoucher({
          id: "receipt",
          documentType: "receipt",
          expiryDate: "2026-04-05",
        }),
      ],
      [30, 14, 7, 3, 1],
      today,
    );
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].voucher.id, "soon");
    assert.equal(alerts[0].daysLeft, 7);
    assert.equal(alerts[0].threshold, 7);
  });
});
