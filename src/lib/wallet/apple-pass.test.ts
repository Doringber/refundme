import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passImageBuffers, solidPng } from "@/lib/wallet/apple-pass-icon";
import {
  applePassMode,
  buildStoreCardPass,
  creditRelevantText,
  normalizePem,
  parseCreditSnapshot,
  passLocations,
  showAppleWalletButton,
  UNSIGNED_PASS_TYPE,
  UNSIGNED_TEAM_ID,
  type CreditSnapshot,
} from "@/lib/wallet/apple-pass";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";

function credit(overrides: Partial<CreditSnapshot> = {}): CreditSnapshot {
  return {
    id: "v-fox-1",
    merchantName: "FOX",
    documentType: "store_credit",
    remainingAmountAgorot: 28000,
    expiryDate: "2026-12-31",
    expiryConfidence: "confirmed",
    voucherCode: "FOX-88421",
    barcodeValue: "7290001234567",
    usageTerms: "בחנויות FOX",
    ...overrides,
  };
}

describe("apple pass availability", () => {
  it("stays hidden until every signing value is a PEM", () => {
    assert.equal(applePassMode({}), "hidden");
    assert.equal(applePassMode({ PASS_DEV_UNSIGNED: "1" }), "unsigned");
    assert.equal(
      applePassMode({
        PASS_TYPE_IDENTIFIER: "pass.com.refundme.credit",
        APPLE_TEAM_ID: "AB12CD34EF",
        PASS_CERT_PEM: PEM,
        PASS_KEY_PEM: "not a pem",
        WWDR_CERT_PEM: PEM,
        PASS_DEV_UNSIGNED: "1",
      }),
      "unsigned",
    );
    assert.equal(
      applePassMode({
        PASS_TYPE_IDENTIFIER: "pass.com.refundme.credit",
        APPLE_TEAM_ID: "AB12CD34EF",
        PASS_CERT_PEM: PEM,
        PASS_KEY_PEM: PEM,
        WWDR_CERT_PEM: PEM,
        PASS_DEV_UNSIGNED: "1",
      }),
      "signed",
    );
  });

  it("rejects a team id or pass type that Wallet would refuse", () => {
    assert.equal(
      applePassMode({
        PASS_TYPE_IDENTIFIER: "com.refundme.credit",
        APPLE_TEAM_ID: "AB12CD34EF",
        PASS_CERT_PEM: PEM,
        PASS_KEY_PEM: PEM,
        WWDR_CERT_PEM: PEM,
      }),
      "hidden",
    );
    assert.equal(
      applePassMode({
        PASS_TYPE_IDENTIFIER: "pass.com.refundme.credit",
        APPLE_TEAM_ID: "short",
        PASS_CERT_PEM: PEM,
        PASS_KEY_PEM: PEM,
        WWDR_CERT_PEM: PEM,
      }),
      "hidden",
    );
  });

  it("turns a Netlify one-line PEM back into real lines", () => {
    assert.equal(normalizePem("-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----"), PEM);
    assert.equal(normalizePem(`  ${PEM}  `), PEM);
  });

  it("shows the button only when this screen can produce a pass", () => {
    const creditRow = {
      passMode: "signed" as const,
      appMode: "supabase" as const,
      documentType: "store_credit",
      remainingAmountAgorot: 100,
    };
    assert.equal(showAppleWalletButton(creditRow), true);
    assert.equal(showAppleWalletButton({ ...creditRow, appMode: "demo" }), false);
    assert.equal(showAppleWalletButton({ ...creditRow, passMode: "hidden" }), false);
    assert.equal(showAppleWalletButton({ ...creditRow, documentType: "receipt" }), false);
    assert.equal(showAppleWalletButton({ ...creditRow, remainingAmountAgorot: 0 }), false);
    assert.equal(
      showAppleWalletButton({ ...creditRow, passMode: "unsigned", appMode: "demo" }),
      true,
    );
  });
});

describe("store card pass", () => {
  it("builds a store card with balance, expiry, barcode and ten locations", () => {
    const pins = Array.from({ length: 12 }, (_, index) => ({
      name: index === 0 ? "FOX רחוק" : `FOX ${index}`,
      lat: 32 + index * 0.01,
      lng: 34.8,
      distanceKm: index === 0 ? 9 : index * 0.2,
    }));
    pins.push({ name: "FOX כפול", lat: 32.2, lng: 34.8, distanceKm: 0.21 });
    pins.push({ name: "רע", lat: 999, lng: 34.8, distanceKm: 0.01 });
    const pass = buildStoreCardPass({
      credit: credit(),
      pins,
      passTypeIdentifier: "pass.com.refundme.credit",
      teamIdentifier: "AB12CD34EF",
    });
    assert.equal(pass.formatVersion, 1);
    assert.equal(pass.storeCard.primaryFields[0]?.value, "280₪");
    assert.equal(pass.storeCard.secondaryFields[0]?.value, "FOX");
    assert.equal(pass.storeCard.auxiliaryFields[0]?.value, "2026-12-31");
    assert.equal(pass.expirationDate, "2026-12-31T23:59:59+03:00");
    assert.equal(pass.barcodes?.[0]?.format, "PKBarcodeFormatCode128");
    assert.equal(pass.barcodes?.[0]?.message, "7290001234567");
    assert.equal(pass.locations?.length, 10);
    assert.equal(pass.locations?.[0]?.relevantText, "יש לך זיכוי של 280₪ ב-FOX 1");
    assert.equal(pass.locations?.some((location) => location.relevantText.includes("רחוק")), false);
    assert.equal("webServiceURL" in pass, false);
    assert.equal("relevantDate" in pass, false);
    assert.equal(pass.sharingProhibited, true);
    assert.equal(pass.serialNumber, "v-fox-1");
  });

  it("omits the barcode and the expiry when the credit has neither", () => {
    const pass = buildStoreCardPass({
      credit: credit({
        barcodeValue: "קוד בעברית",
        voucherCode: null,
        expiryConfidence: "uncertain",
      }),
      pins: [],
      passTypeIdentifier: UNSIGNED_PASS_TYPE,
      teamIdentifier: UNSIGNED_TEAM_ID,
    });
    assert.equal(pass.barcodes, undefined);
    assert.equal(pass.expirationDate, undefined);
    assert.equal(pass.locations, undefined);
    assert.equal(pass.storeCard.auxiliaryFields.length, 0);
    assert.match(pass.storeCard.backFields.map((field) => field.value).join(" "), /אין קוד/);
  });

  it("rejects a receipt and keeps a real street credit", () => {
    assert.equal(parseCreditSnapshot({ documentType: "receipt", remainingAmountAgorot: 100 }), null);
    const parsed = parseCreditSnapshot(credit({ usageTerms: "  קופה  " }));
    assert.equal(parsed?.usageTerms, "קופה");
    assert.equal(creditRelevantText(15050, "סופר-פארם"), "יש לך זיכוי של 150.50₪ ב-סופר-פארם");
  });

  it("orders locations by distance and drops a second pin on the same doorway", () => {
    const locations = passLocations(
      [
        { name: "רחוק", lat: 32.2, lng: 34.8, distanceKm: 4 },
        { name: "קרוב", lat: 32.07, lng: 34.79, distanceKm: 0.1 },
        { name: "אותו פתח", lat: 32.07001, lng: 34.79001, distanceKm: 0.11 },
      ],
      5000,
      "FOX",
    );
    assert.equal(locations.length, 2);
    assert.match(locations[0]!.relevantText, /קרוב/);
  });
});

describe("pass images", () => {
  it("builds the icon sizes Wallet asks for", () => {
    const images = passImageBuffers();
    assert.equal(images["icon.png"]?.readUInt32BE(16), 29);
    assert.equal(images["icon@2x.png"]?.readUInt32BE(16), 58);
    assert.equal(images["icon@3x.png"]?.readUInt32BE(16), 87);
    const logo = solidPng(160, 50, [255, 224, 138]);
    assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(logo.readUInt32BE(20), 50);
  });
});
