import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_BRANCHES } from "@/lib/demo/data";
import type { Voucher } from "@/lib/types";
import { haversineKm, nearbyRedeemableCredits } from "./nearby";

function voucher(overrides: Partial<Voucher>): Voucher {
  return {
    id: "v",
    userId: "u",
    merchantId: null,
    merchantName: "FOX",
    documentType: "store_credit",
    status: "active",
    originalAmountAgorot: 28000,
    remainingAmountAgorot: 28000,
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

const dizengoff = { lat: 32.075, lng: 34.775 };

describe("nearby stores", () => {
  it("sorts a Tel Aviv point closer to Dizengoff than to Haifa", () => {
    const foxDizengoff = DEMO_BRANCHES.find((branch) => branch.id === "b1");
    const foxHaifa = DEMO_BRANCHES.find((branch) => branch.id === "b3");
    const dizLat = foxDizengoff?.lat;
    const dizLng = foxDizengoff?.lng;
    const haifaLat = foxHaifa?.lat;
    const haifaLng = foxHaifa?.lng;
    if (dizLat == null || dizLng == null || haifaLat == null || haifaLng == null) {
      throw new Error("missing branch coordinates");
    }
    const near = haversineKm(dizengoff.lat, dizengoff.lng, dizLat, dizLng);
    const far = haversineKm(dizengoff.lat, dizengoff.lng, haifaLat, haifaLng);
    assert.ok(near < 2);
    assert.ok(far > 50);
  });

  it("highlights a matching voucher near the user and skips receipts and other chains", () => {
    const located = DEMO_BRANCHES.map((branch) => ({
      ...branch,
      distanceKm:
        branch.lat != null && branch.lng != null
          ? haversineKm(dizengoff.lat, dizengoff.lng, branch.lat, branch.lng)
          : null,
    }));
    const credits = nearbyRedeemableCredits(
      located,
      [
        voucher({ id: "fox", merchantName: "FOX", remainingAmountAgorot: 28000 }),
        voucher({
          id: "foody",
          merchantName: "BUYME FOODY - מתנות קולינריות שוות",
          documentType: "shopping_voucher",
          remainingAmountAgorot: 20000,
        }),
        voucher({
          id: "receipt",
          merchantName: "יוחננוף",
          documentType: "receipt",
          status: "archived",
        }),
        voucher({
          id: "shufersal",
          merchantId: "11111111-1111-1111-1111-111111111107",
          merchantName: "שופרסל",
          remainingAmountAgorot: 1990,
        }),
      ],
      { hasLocation: true, city: "" },
    );
    assert.deepEqual(
      credits.map((credit) => credit.voucherId),
      ["fox", "shufersal"],
    );
    assert.equal(credits[0].amountAgorot, 28000);
    assert.match(credits[0].nearestBranchName, /FOX/);
  });

  it("uses the selected city when location is unavailable", () => {
    const credits = nearbyRedeemableCredits(
      DEMO_BRANCHES.map((branch) => ({ ...branch, distanceKm: null })),
      [voucher({ merchantName: "איקאה", remainingAmountAgorot: 5000, id: "ikea" })],
      { hasLocation: false, city: "נתניה" },
    );
    assert.equal(credits.length, 1);
    assert.equal(credits[0].nearestBranchName, "איקאה נתניה");
  });
});
