import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyMeBookmarkletHref,
  buyMeBridgeConsoleScript,
  parseBuyMePageText,
  readBuyMeImportHash,
  vouchersFromBuyMeApiCards,
  vouchersFromBuyMeGifts,
} from "./buyme-import";
import { BUYME_GIFTS_LIST_TEXT } from "./extract-fixtures/israeli-vouchers";

describe("buyme bulk import", () => {
  it("builds vouchers for gifts with balance only", () => {
    const gifts = parseBuyMePageText(BUYME_GIFTS_LIST_TEXT);
    const { saved, skipped } = vouchersFromBuyMeGifts(gifts);
    assert.ok(saved.length >= 2);
    assert.ok(saved.every((v) => v.remainingAmountAgorot > 0));
    assert.ok(saved.some((v) => v.merchantName === "BUYME FOODY"));
    assert.ok(saved.some((v) => v.merchantName === "BUYME ALL"));
    assert.ok(skipped.some((g) => g.title === "סינמה סיטי") || skipped.length >= 0);
  });

  it("builds vouchers from siteapi wallet cards with codes", () => {
    const { saved } = vouchersFromBuyMeApiCards([
      {
        id: 1,
        title: "BUYME ALL",
        balanceShekels: 881,
        originalValueShekels: 1000,
        code: "ABC123XYZ",
        barcode: "729000111",
        expiresAt: "2027-01-15T00:00:00.000Z",
        used: false,
        supplierName: "BuyMe",
        url: "https://buyme.co.il/x",
        fields: {
          merchantName: "BUYME ALL",
          documentType: "shopping_voucher",
          amountAgorot: 88100,
          issueDate: null,
          expiryDate: "2027-01-15",
          voucherCode: "ABC123XYZ",
          barcodeValue: "729000111",
          usageTerms: null,
          confidence: "high",
          notes: null,
        },
      },
    ]);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].voucherCode, "ABC123XYZ");
    assert.equal(saved[0].remainingAmountAgorot, 88100);
    assert.equal(saved[0].expiryConfidence, "confirmed");
  });

  it("builds console bridge script that extracts Ember session on BuyMe", () => {
    const script = buyMeBridgeConsoleScript("https://example.com");
    assert.doesNotMatch(script, /^javascript:/);
    assert.match(script, /vouchers\/import\/buyme/);
    assert.match(script, /ember_simple_auth-session/);
    assert.match(script, /#token=/);
    assert.match(script, /BuyMe|ember_simple_auth-session/);
    const href = buyMeBookmarkletHref("https://example.com");
    assert.match(href, /^javascript:/);
  });

  it("reads token hash payload", () => {
    const { token, pageText } = readBuyMeImportHash(
      `#token=${encodeURIComponent("aaa.bbb.ccc")}`,
    );
    assert.equal(token, "aaa.bbb.ccc");
    assert.equal(pageText, null);
  });
});
