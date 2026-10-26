import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Voucher } from "@/lib/types";
import {
  checkoutKind,
  offerCheckoutDisplay,
  voucherCodeInputError,
} from "./checkout-display";

function voucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "v1",
    userId: "u1",
    merchantId: null,
    merchantName: "BUYME FOODY - מתנות קולינריות שוות",
    documentType: "shopping_voucher",
    status: "active",
    originalAmountAgorot: 20000,
    remainingAmountAgorot: 20000,
    currency: "ILS",
    issueDate: null,
    expiryDate: null,
    expiryConfidence: "missing",
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

describe("checkout display", () => {
  it("shows a code when one is stored", () => {
    const item = voucher({ voucherCode: "1234567890123456" });
    assert.equal(checkoutKind(item), "code");
    assert.equal(offerCheckoutDisplay(item), true);
  });

  it("offers a BuyMe link instead of an empty scanner", () => {
    const item = voucher({
      extractionRaw: {
        provider: "buyme",
        url: "https://buyme.co.il/giftcard/foody",
      },
    });
    assert.equal(checkoutKind(item), "buyme");
    assert.equal(offerCheckoutDisplay(item), true);
  });

  it("ignores a non-BuyMe link and hides checkout when nothing else exists", () => {
    const item = voucher({
      extractionRaw: { provider: "buyme", url: "https://evil.example/x" },
    });
    assert.equal(checkoutKind(item), "none");
    assert.equal(offerCheckoutDisplay(item), false);
  });

  it("offers the document when that is all we have", () => {
    const item = voucher({ documentDataUrl: "data:image/png;base64,aaa" });
    assert.equal(checkoutKind(item), "document");
    assert.equal(offerCheckoutDisplay(item), true);
  });

  it("rejects a too-short manual code", () => {
    assert.equal(voucherCodeInputError("12"), "הזינו קוד שובר (4–80 תווים)");
    assert.equal(voucherCodeInputError("123456"), null);
  });
});
