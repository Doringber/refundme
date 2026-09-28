import type { DocumentType, VoucherStatus } from "./types";

/** Days remaining thresholds for Credit Orb countdown ring */
export const EXPIRY_URGENT_DAYS = 7;
export const EXPIRY_UPCOMING_DAYS = 30;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  store_credit: "זיכוי החזרה",
  gift_voucher: "שובר מתנה",
  shopping_voucher: "שובר קנייה",
  receipt: "קבלה / חשבונית",
};

export const STATUS_LABELS: Record<VoucherStatus, string> = {
  active: "פעיל",
  partially_redeemed: "נוצל חלקית",
  fully_redeemed: "נוצל במלואו",
  expired: "פג תוקף",
  archived: "בארכיון",
};

export const SPENDABLE_TYPES: DocumentType[] = [
  "store_credit",
  "gift_voucher",
  "shopping_voucher",
];

export const DEMO_COOKIE = "zikuy_demo";
/** v2 adds demo document preview images */
export const DEMO_STORAGE_KEY = "zikuy_sheli_demo_v2";

export const APP_NAME = "זיכוי שלי";
