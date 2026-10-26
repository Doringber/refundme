import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeBuyMeVoucherRecord } from "./wallet";

describe("BuyMe wallet card normalize", () => {
  it("reads lowercase list fields and keeps a buyme.co.il link", () => {
    const card = normalizeBuyMeVoucherRecord({
      id: 7,
      title: "BUYME FOODY - מתנות קולינריות שוות",
      amount: 200,
      originalValue: 200,
      serialnumber: "1234567890123456",
      voucherBarcode: "7290001234567",
      shortToken: "food-token",
      url: "https://buyme.co.il/giftcard/foody",
      used: false,
      supplier: { name: "BUYME FOODY" },
    });
    assert.ok(card);
    assert.equal(card.code, "1234567890123456");
    assert.equal(card.barcode, "7290001234567");
    assert.equal(card.url, "https://buyme.co.il/giftcard/foody");
    assert.equal(card.shortToken, "food-token");
    assert.equal(card.balanceShekels, 200);
  });

  it("reads camelCase and nested code aliases", () => {
    const card = normalizeBuyMeVoucherRecord({
      id: "9",
      title: "FOX",
      amount: "50",
      serialNumber: "FOX-1",
      codes: [{ barcodeValue: "729111" }],
      redeemUrl: "/giftcard/fox-1",
    });
    assert.equal(card?.code, "FOX-1");
    assert.equal(card?.barcode, "729111");
    assert.equal(card?.url, "https://buyme.co.il/giftcard/fox-1");
  });

  it("drops codes and links that are not a BuyMe https url or a real code", () => {
    const card = normalizeBuyMeVoucherRecord({
      id: 3,
      title: "BUYME FOODY - מתנות קולינריות שוות",
      amount: 200,
      url: "https://evil.example/phish",
      code: "https://buyme.co.il/not-a-code",
    });
    assert.equal(card?.code, null);
    assert.equal(card?.barcode, null);
    assert.equal(card?.url, null);
  });
});
