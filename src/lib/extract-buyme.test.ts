import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractBuyMeGifts, looksLikeBuyMe } from "./extract-buyme";
import { suggestFieldsFromText } from "./extract";
import {
  BUYME_GIFTS_LIST_TEXT,
  BUYME_VOUCHER_TEXT,
} from "./extract-fixtures/israeli-vouchers";

describe("BuyMe gifts import", () => {
  it("detects BuyMe gifts list screenshots", () => {
    assert.equal(looksLikeBuyMe(BUYME_GIFTS_LIST_TEXT), true);
  });

  it("parses multiple gifts with titles and balances", () => {
    const gifts = extractBuyMeGifts(BUYME_GIFTS_LIST_TEXT);
    assert.ok(gifts.length >= 3);
    const titles = gifts.map((g) => g.title);
    assert.ok(titles.includes("סינמה סיטי"));
    assert.ok(titles.includes("BUYME FOODY"));
    assert.ok(titles.includes("BUYME ALL"));

    const foody = gifts.find((g) => g.title === "BUYME FOODY");
    assert.equal(foody?.amountAgorot, 20000);

    const all = gifts.find((g) => g.title === "BUYME ALL");
    assert.equal(all?.amountAgorot, 88100);
  });

  it("suggestFieldsFromText picks a balanced BuyMe gift", () => {
    const fields = suggestFieldsFromText(BUYME_GIFTS_LIST_TEXT);
    assert.equal(fields.documentType, "shopping_voucher");
    assert.ok(fields.amountAgorot === 20000 || fields.amountAgorot === 88100);
    assert.match(fields.merchantName ?? "", /BUYME|סינמה/i);
  });

  it("still parses single BuyMe voucher code text", () => {
    const fields = suggestFieldsFromText(BUYME_VOUCHER_TEXT);
    assert.equal(fields.merchantName, "BuyMe");
    assert.equal(fields.amountAgorot, 15000);
    assert.equal(fields.voucherCode, "BM7K9X2Q4P");
  });
});
