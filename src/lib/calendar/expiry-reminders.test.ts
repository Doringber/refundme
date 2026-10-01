import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExpiryCalendarReminder,
  canAddExpiryCalendar,
  toIcsDate,
} from "./expiry-reminders";
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
    expiryDate: "2026-12-31",
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

describe("expiry calendar reminders", () => {
  it("formats ICS dates", () => {
    assert.equal(toIcsDate("2026-12-31"), "20261231");
  });

  it("requires confirmed expiry", () => {
    assert.equal(canAddExpiryCalendar(sampleVoucher()), true);
    assert.equal(
      canAddExpiryCalendar(
        sampleVoucher({ expiryConfidence: "missing", expiryDate: null }),
      ),
      false,
    );
  });

  it("builds ICS with alarms and Google URL", async () => {
    const built = buildExpiryCalendarReminder(sampleVoucher(), [7, 1]);
    assert.ok(built);
    assert.match(built.googleUrl, /calendar\.google\.com/);
    assert.match(built.googleUrl, /20261231/);
    const text = await built.icsBlob.text();
    assert.match(text, /BEGIN:VCALENDAR/);
    assert.match(text, /פקיעת זיכוי/);
    assert.match(text, /TRIGGER:-P7D/);
    assert.match(text, /TRIGGER:-P1D/);
    assert.match(text, /תזכורת זיכוי/);
  });
});
