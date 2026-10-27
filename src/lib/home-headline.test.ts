import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_NAME } from "./constants";
import { homeHeadline } from "./home-headline";
import type { Voucher } from "./types";

function voucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "v1",
    userId: "u1",
    merchantId: null,
    merchantName: "FOX",
    documentType: "store_credit",
    status: "active",
    originalAmountAgorot: 10000,
    remainingAmountAgorot: 10000,
    currency: "ILS",
    issueDate: null,
    expiryDate: "2026-04-03",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("homeHeadline", () => {
  it("is personal and never the static brand", () => {
    const title = homeHeadline({
      displayName: "דור אינגבר",
      totalAgorot: 50000,
      voucherCount: 3,
      nearestExpiring: null,
      daysUntilNearestExpiry: null,
      now: new Date("2026-04-01T09:00:00"),
    });
    assert.match(title, /דור/);
    assert.notEqual(title, APP_NAME);
    assert.doesNotMatch(title, new RegExp(`^${APP_NAME}$`));
  });

  it("uses empty-state humor when no credits", () => {
    const title = homeHeadline({
      displayName: "Dor",
      totalAgorot: 0,
      voucherCount: 0,
      nearestExpiring: null,
      daysUntilNearestExpiry: null,
      now: new Date("2026-04-01T21:00:00"),
    });
    assert.match(title, /Dor/);
    assert.match(title, /ריק|אין|בודד|אבק/i);
  });

  it("mentions merchant when expiry is near", () => {
    const title = homeHeadline({
      displayName: "דור",
      totalAgorot: 3520,
      voucherCount: 1,
      nearestExpiring: voucher({ merchantName: "סופר-פארם" }),
      daysUntilNearestExpiry: 2,
      now: new Date("2026-04-01T15:00:00"),
    });
    assert.match(title, /סופר-פארם/);
  });
});
