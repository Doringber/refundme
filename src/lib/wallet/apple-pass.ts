import { SPENDABLE_TYPES } from "@/lib/constants";
import type { DocumentType, ExpiryConfidence, Voucher } from "@/lib/types";

/**
 * Apple Wallet store card for one credit.
 *
 * Location relevance is a hint Wallet may use on a real iPhone. This file
 * does not sign anything and does not set webServiceURL: pass updates
 * (moving the 10 locations as the person travels, plus APNs) are the next
 * step, written up in docs/apple-wallet.md. A store card does not use
 * relevantDate — Apple ignores it for this pass style.
 */

export const PASS_LOCATION_LIMIT = 10;
export const UNSIGNED_PASS_TYPE = "pass.com.refundme.credit.dev";
export const UNSIGNED_TEAM_ID = "DEVTEAM00";

const SPENDABLE = new Set<string>(SPENDABLE_TYPES);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE128 = /^[\x20-\x7E]{1,80}$/;

export type ApplePassMode = "hidden" | "signed" | "unsigned";

export type PassLocation = {
  latitude: number;
  longitude: number;
  relevantText: string;
};

export type PassBarcode = {
  format: "PKBarcodeFormatCode128" | "PKBarcodeFormatQR";
  message: string;
  messageEncoding: "iso-8859-1";
  altText: string;
};

export type PassField = {
  key: string;
  label: string;
  value: string;
  textAlignment?: "PKTextAlignmentNatural";
};

export type CreditSnapshot = {
  id: string;
  merchantName: string;
  documentType: "store_credit" | "gift_voucher" | "shopping_voucher";
  remainingAmountAgorot: number;
  expiryDate: string | null;
  expiryConfidence: ExpiryConfidence;
  voucherCode: string | null;
  barcodeValue: string | null;
  usageTerms: string | null;
};

export type PassPin = {
  name: string;
  lat: number;
  lng: number;
  distanceKm?: number | null;
};

export type StorePassDefinition = {
  formatVersion: 1;
  passTypeIdentifier: string;
  teamIdentifier: string;
  serialNumber: string;
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  sharingProhibited: true;
  storeCard: {
    primaryFields: PassField[];
    secondaryFields: PassField[];
    auxiliaryFields: PassField[];
    backFields: PassField[];
  };
  barcodes?: PassBarcode[];
  locations?: PassLocation[];
  expirationDate?: string;
  userInfo: { voucherId: string };
};

type EnvLike = Record<string, string | undefined>;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Netlify stores multiline PEMs with literal \n. Leave real newlines alone. */
export function normalizePem(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

function pemReady(value: string | undefined): boolean {
  const text = (value ?? "").trim();
  return text.includes("BEGIN") && text.includes("END");
}

/** Signing is on only when every certificate value looks like a PEM. */
export function applePassMode(env: EnvLike = process.env): ApplePassMode {
  const passType = (env.PASS_TYPE_IDENTIFIER ?? "").trim();
  const team = (env.APPLE_TEAM_ID ?? "").trim();
  const signing =
    passType.startsWith("pass.") &&
    passType.length > 5 &&
    passType.length <= 80 &&
    /^[A-Z0-9]{10}$/.test(team) &&
    pemReady(env.PASS_CERT_PEM) &&
    pemReady(env.PASS_KEY_PEM) &&
    pemReady(env.WWDR_CERT_PEM);
  if (signing) return "signed";
  if ((env.PASS_DEV_UNSIGNED ?? "").trim() === "1") return "unsigned";
  return "hidden";
}

export function isWalletCredit(voucher: {
  documentType: string;
  remainingAmountAgorot: number;
}): boolean {
  return SPENDABLE.has(voucher.documentType) && voucher.remainingAmountAgorot > 0;
}

/**
 * The voucher screen shows the button only when a pass can actually be built.
 * A signed pass is never minted from demo data the browser invented.
 */
export function showAppleWalletButton(input: {
  passMode: ApplePassMode;
  appMode: "demo" | "supabase";
  documentType: string;
  remainingAmountAgorot: number;
}): boolean {
  if (!isWalletCredit(input)) return false;
  if (input.passMode === "signed") return input.appMode === "supabase";
  return input.passMode === "unsigned";
}

export function shekelLabel(agorot: number): string {
  const shekels = agorot / 100;
  const formatted = new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: shekels % 1 === 0 ? 0 : 2,
    minimumFractionDigits: shekels % 1 === 0 ? 0 : 2,
  }).format(shekels);
  return `${formatted}₪`;
}

/** Lock-screen line. Store cards get a short explanation, not a push. */
export function creditRelevantText(agorot: number, store: string): string {
  const place = clean(store, 48) || "חנות";
  const text = `יש לך זיכוי של ${shekelLabel(agorot)} ב-${place}`;
  return text.length > 100 ? text.slice(0, 100) : text;
}

export function passBarcode(code: string | null): PassBarcode | null {
  const message = (code ?? "").trim();
  if (!message || message.length > 80 || !CODE128.test(message)) return null;
  return {
    format: message.length <= 20 && /^[A-Za-z0-9-]+$/.test(message)
      ? "PKBarcodeFormatCode128"
      : "PKBarcodeFormatQR",
    message,
    messageEncoding: "iso-8859-1",
    altText: message.slice(0, 40),
  };
}

function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Nearest pins first, at most 10, skipping bad coordinates and duplicate points. */
export function passLocations(
  pins: PassPin[],
  agorot: number,
  merchantName: string,
): PassLocation[] {
  const ordered = [...pins].sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
  const locations: PassLocation[] = [];
  for (const pin of ordered) {
    if (locations.length >= PASS_LOCATION_LIMIT) break;
    if (!Number.isFinite(pin.lat) || pin.lat < -90 || pin.lat > 90) continue;
    if (!Number.isFinite(pin.lng) || pin.lng < -180 || pin.lng > 180) continue;
    const latitude = roundCoord(pin.lat);
    const longitude = roundCoord(pin.lng);
    const duplicate = locations.some(
      (other) =>
        Math.abs(other.latitude - latitude) < 0.0002 &&
        Math.abs(other.longitude - longitude) < 0.0002,
    );
    if (duplicate) continue;
    const store = clean(pin.name, 48) || clean(merchantName, 48);
    locations.push({
      latitude,
      longitude,
      relevantText: creditRelevantText(agorot, store),
    });
  }
  return locations;
}

function field(key: string, label: string, value: string): PassField {
  return { key, label, value, textAlignment: "PKTextAlignmentNatural" };
}

export function snapshotFromVoucher(voucher: Voucher): CreditSnapshot | null {
  return parseCreditSnapshot({
    id: voucher.id,
    merchantName: voucher.merchantName,
    documentType: voucher.documentType,
    remainingAmountAgorot: voucher.remainingAmountAgorot,
    expiryDate: voucher.expiryDate,
    expiryConfidence: voucher.expiryConfidence,
    voucherCode: voucher.voucherCode,
    barcodeValue: voucher.barcodeValue,
    usageTerms: voucher.usageTerms,
  });
}

export function parseCreditSnapshot(input: unknown): CreditSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const documentType = row.documentType;
  if (
    documentType !== "store_credit" &&
    documentType !== "gift_voucher" &&
    documentType !== "shopping_voucher"
  ) {
    return null;
  }
  const id = clean(row.id, 80);
  const merchantName = clean(row.merchantName, 80);
  const remaining = row.remainingAmountAgorot;
  if (!id || !merchantName || typeof remaining !== "number") return null;
  if (!Number.isInteger(remaining) || remaining <= 0 || remaining > 100_000_000) return null;
  const confidence = row.expiryConfidence;
  const expiryConfidence: ExpiryConfidence =
    confidence === "confirmed" || confidence === "uncertain" || confidence === "missing"
      ? confidence
      : "missing";
  const expiryRaw = row.expiryDate;
  const expiryDate =
    typeof expiryRaw === "string" && DATE.test(expiryRaw) ? expiryRaw : null;
  const voucherCode = clean(row.voucherCode, 80) || null;
  const barcodeValue = clean(row.barcodeValue, 80) || null;
  const usageTerms = clean(row.usageTerms, 300) || null;
  return {
    id,
    merchantName,
    documentType: documentType as DocumentType & CreditSnapshot["documentType"],
    remainingAmountAgorot: remaining,
    expiryDate,
    expiryConfidence,
    voucherCode,
    barcodeValue,
    usageTerms,
  };
}

export function parseOrigin(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const latitude = typeof lat === "number" ? lat : typeof lat === "string" ? Number(lat) : NaN;
  const longitude = typeof lng === "number" ? lng : typeof lng === "string" ? Number(lng) : NaN;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { lat: latitude, lng: longitude };
}

export function buildStoreCardPass(input: {
  credit: CreditSnapshot;
  pins: PassPin[];
  passTypeIdentifier: string;
  teamIdentifier: string;
}): StorePassDefinition {
  const { credit } = input;
  const amount = shekelLabel(credit.remainingAmountAgorot);
  const code = passBarcode(credit.barcodeValue || credit.voucherCode);
  const locations = passLocations(input.pins, credit.remainingAmountAgorot, credit.merchantName);
  const confirmedExpiry =
    credit.expiryConfidence === "confirmed" && credit.expiryDate ? credit.expiryDate : null;
  const back: PassField[] = [
    field("reported", "יתרה", `${amount} לפי הדיווח שלך`),
  ];
  if (code) back.push(field("code", "קוד", code.message));
  else back.push(field("code", "קוד", "אין קוד שמור על הזיכוי"));
  if (credit.usageTerms) back.push(field("terms", "תנאים", credit.usageTerms));
  if (!locations.length) {
    back.push(
      field(
        "where",
        "סניפים",
        "לא צורפו סניפים עם מיקום. הכרטיס נשמר ב-Wallet בלי הופעה על מסך הנעילה.",
      ),
    );
  }
  const pass: StorePassDefinition = {
    formatVersion: 1,
    passTypeIdentifier: input.passTypeIdentifier,
    teamIdentifier: input.teamIdentifier,
    serialNumber: credit.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "credit",
    organizationName: "זיכוי שלי",
    description: `זיכוי ב-${credit.merchantName}`.slice(0, 80),
    logoText: credit.merchantName.slice(0, 20),
    foregroundColor: "rgb(28, 28, 28)",
    backgroundColor: "rgb(255, 224, 138)",
    labelColor: "rgb(58, 52, 44)",
    sharingProhibited: true,
    storeCard: {
      primaryFields: [field("balance", "יתרה", amount)],
      secondaryFields: [field("store", "חנות", credit.merchantName)],
      auxiliaryFields: confirmedExpiry ? [field("expiry", "תוקף", confirmedExpiry)] : [],
      backFields: back,
    },
    userInfo: { voucherId: credit.id },
  };
  if (code) pass.barcodes = [code];
  if (locations.length) pass.locations = locations;
  if (confirmedExpiry) pass.expirationDate = `${confirmedExpiry}T23:59:59+03:00`;
  return pass;
}
