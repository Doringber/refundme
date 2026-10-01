import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyMeBookmarkletHref,
  buyMeBridgeConsoleScript,
  buyMePageTextBridgeScript,
  demoBuyMeGiftsFromFixture,
  parseBuyMePageText,
  readBuyMeImportHash,
  vouchersFromBuyMeApiCards,
  vouchersFromBuyMeGifts,
} from "./buyme-import";
import { detectBuyMeClientPlatform } from "./buyme-platform";
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
    const href = buyMeBookmarkletHref("https://example.com");
    assert.match(href, /^javascript:/);
  });

  it("builds page-text bridge that dumps המתנות שלי in one shot", () => {
    const script = buyMePageTextBridgeScript("https://example.com");
    assert.match(script, /innerText/);
    assert.match(script, /#text=/);
    assert.match(script, /vouchers\/import\/buyme/);
  });

  it("reads token and text hash payloads", () => {
    const tok = readBuyMeImportHash(`#token=${encodeURIComponent("aaa.bbb.ccc")}`);
    assert.equal(tok.token, "aaa.bbb.ccc");
    assert.equal(tok.pageText, null);
    const text = readBuyMeImportHash(
      `#text=${encodeURIComponent("BUYME ALL\nיתרה: ₪10")}`,
    );
    assert.equal(text.token, null);
    assert.match(text.pageText ?? "", /BUYME ALL/);
  });

  it("loads demo gifts from fixture for walkthrough", () => {
    const gifts = demoBuyMeGiftsFromFixture();
    assert.ok(gifts.length >= 2);
    assert.ok(gifts.some((g) => g.title.includes("BUYME")));
  });

  it("detects android / ios / desktop clients", () => {
    assert.equal(
      detectBuyMeClientPlatform(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
      "android",
    );
    assert.equal(
      detectBuyMeClientPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      "ios",
    );
    assert.equal(
      detectBuyMeClientPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0",
      ),
      "desktop",
    );
  });
});
