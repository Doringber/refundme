import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { barcodePayload, code128Svg, encodeCode128Widths } from "./code128";

describe("code128", () => {
  it("encodes numeric payload with widths", () => {
    const widths = encodeCode128Widths("999027309137");
    assert.ok(widths.length > 10);
    assert.ok(widths.every((w) => w >= 1 && w <= 4 || w === 2));
  });

  it("builds svg markup", () => {
    const svg = code128Svg("ABC123");
    assert.ok(svg);
    assert.match(svg!, /^<svg /);
    assert.match(svg!, /<rect /);
  });

  it("prefers barcode value for payload", () => {
    assert.equal(
      barcodePayload({ barcodeValue: "999027309137", voucherCode: "27309137" }),
      "999027309137",
    );
    assert.equal(
      barcodePayload({ barcodeValue: null, voucherCode: "ABC-99" }),
      "ABC-99",
    );
  });
});
