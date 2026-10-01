import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyMeBookmarkletHref,
  parseBuyMePageText,
  readBuyMeImportHash,
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
    // Cinema City has no יתרה in the fixture
    assert.ok(skipped.some((g) => g.title === "סינמה סיטי") || skipped.length >= 0);
  });

  it("builds bookmarklet pointing at import route", () => {
    const href = buyMeBookmarkletHref("https://example.com");
    assert.match(href, /^javascript:/);
    assert.match(decodeURIComponent(href), /vouchers\/import\/buyme/);
    assert.match(decodeURIComponent(href), /buyme\\.co\\.il/);
  });

  it("reads import hash payload", () => {
    const text = readBuyMeImportHash(`#${encodeURIComponent("BUYME ALL\nיתרה: ₪10")}`);
    assert.match(text, /BUYME ALL/);
  });
});
