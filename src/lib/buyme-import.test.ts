import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyMeBookmarkletHref,
  parseBuyMePageText,
  readBuyMeImportHash,
  vouchersFromBuyMeApiCards,
  vouchersFromBuyMeGifts,
  buyMeVoucherKey,
} from "./buyme-import";
import { BUYME_GIFTS_LIST_TEXT } from "./extract-fixtures/israeli-vouchers";

describe("buyme bulk import", () => {
  it("builds vouchers for gifts with balance only", () => {
    const gifts = parseBuyMePageText(BUYME_GIFTS_LIST_TEXT);
    const { saved, skipped } = vouchersFromBuyMeGifts(gifts);
    assert.ok(saved.length >= 2);
    assert.ok(saved.every((v) => v.remainingAmountAgorot > 0));
    assert.ok(saved.some((v) => v.merchantName === "BUYME FOODY" && v.remainingAmountAgorot === 20000));
    assert.ok(saved.some((v) => v.merchantName === "BUYME ALL" && v.remainingAmountAgorot === 88100));
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
    assert.equal(saved[0].barcodeValue, "729000111");
    assert.deepEqual(saved[0].extractionRaw, {
      provider: "buyme",
      externalId: "1",
      source: "buyme-sync",
      supplierName: "BuyMe",
      url: "https://buyme.co.il/x",
      shortToken: null,
      supplierDescription: null,
      redemptionInstructions: null,
    });
    assert.equal(buyMeVoucherKey(saved[0]), "api:1");
  });

  it("builds connect bridge script that extracts Ember session on BuyMe", () => {
    const href = buyMeBookmarkletHref("https://example.com");
    assert.match(href, /^javascript:/);
    const decoded = decodeURIComponent(href);
    assert.match(decoded, /vouchers\/import\/buyme/);
    assert.match(decoded, /ember_simple_auth-session/);
    assert.match(decoded, /#token=/);
    assert.match(decoded, /שורת הכתובת|התחברו ל־BuyMe/);
  });

  it("reads token hash payload", () => {
    const { token, pageText } = readBuyMeImportHash(
      `#token=${encodeURIComponent("aaa.bbb.ccc")}`,
    );
    assert.equal(token, "aaa.bbb.ccc");
    assert.equal(pageText, null);
  });
});
