import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestFieldsFromText } from "./extract";
import {
  SHUFERSAL_CREDIT_TEXT,
  SUPERPHARM_CREDIT_TEXT,
  YOCHANANOF_RECEIPT_TEXT,
} from "./extract-fixtures/israeli-vouchers";

describe("Israeli live voucher extraction", () => {
  it("parses Shufersal תעודת זיכוי (19.90, code, relative 2y expiry)", () => {
    const fields = suggestFieldsFromText(SHUFERSAL_CREDIT_TEXT);
    assert.equal(fields.merchantName, "שופרסל");
    assert.equal(fields.documentType, "store_credit");
    assert.equal(fields.amountAgorot, 1990);
    assert.equal(fields.voucherCode, "1-117-07-046638");
    // Relative "שנתיים" — do not invent a calendar expiry
    assert.equal(fields.expiryDate, null);
    assert.match(fields.notes ?? "", /שנתיים|תוקף/);
    assert.notEqual(fields.confidence, "none");
  });

  it("parses Super-Pharm שובר זיכוי with printed expiry and barcode", () => {
    const fields = suggestFieldsFromText(SUPERPHARM_CREDIT_TEXT);
    assert.equal(fields.merchantName, "סופר-פארם");
    assert.equal(fields.documentType, "store_credit");
    assert.equal(fields.amountAgorot, 3520);
    assert.equal(fields.voucherCode, "27309137");
    assert.equal(fields.issueDate, "2025-01-21");
    assert.equal(fields.expiryDate, "2027-01-21");
    assert.equal(fields.barcodeValue, "999027309137");
    assert.equal(fields.confidence, "high");
  });

  it("classifies Yochananof חשבונית קבלה as receipt (not spendable credit)", () => {
    const fields = suggestFieldsFromText(YOCHANANOF_RECEIPT_TEXT);
    assert.equal(fields.merchantName, "יוחננוף");
    assert.equal(fields.documentType, "receipt");
    assert.equal(fields.amountAgorot, 2170);
    assert.notEqual(fields.confidence, "none");
  });
});
