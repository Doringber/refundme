import type { BuyMeGiftCandidate } from "./extract-buyme";
import { extractBuyMeGifts } from "./extract-buyme";
import { DEMO_USER_ID } from "./demo/data";
import { shekelsToAgorot } from "./calculations";
import type { ExtractedFields, Voucher } from "./types";

export const BUYME_IMPORT_PATH = "/vouchers/import/buyme";

/** BuyMe web app — opened as the temporary connect window. */
export const BUYME_SITE_URL = "https://buyme.co.il/";

/** postMessage type when the connect popup finished saving the session. */
export const BUYME_CONNECTED_MESSAGE = "buyme-connected" as const;

/** localStorage key — fires `storage` in other same-origin tabs/windows. */
export const BUYME_CONNECTED_STORAGE_KEY = "zikuy:buyme-connected";

/** Wallet card shape returned by `/api/buyme/wallet` (client-safe). */
export type BuyMeApiCard = {
  id: number | string;
  title: string;
  balanceShekels: number;
  originalValueShekels: number | null;
  code: string | null;
  barcode: string | null;
  expiresAt: string | null;
  used: boolean;
  supplierName: string | null;
  url: string | null;
  fields: ExtractedFields;
};

/** Build a voucher draft from a parsed BuyMe gift card (no redemption code required). */
export function voucherFromBuyMeGift(
  gift: BuyMeGiftCandidate,
  opts: {
    userId?: string;
    documentMeta?: {
      fileName: string | null;
      mimeType: string | null;
      dataUrl: string | null;
    };
  } = {},
): Voucher | null {
  if (gift.amountAgorot == null || gift.amountAgorot <= 0) return null;
  const now = new Date().toISOString();
  const f = gift.fields;
  return {
    id: crypto.randomUUID(),
    userId: opts.userId ?? DEMO_USER_ID,
    merchantId: null,
    merchantName: gift.title,
    documentType: "shopping_voucher",
    status: "active",
    originalAmountAgorot: gift.amountAgorot,
    remainingAmountAgorot: gift.amountAgorot,
    currency: "ILS",
    issueDate: null,
    expiryDate: f.expiryDate,
    expiryConfidence: f.expiryDate ? "uncertain" : "missing",
    voucherCode: f.voucherCode,
    barcodeValue: f.barcodeValue,
    usageTerms: f.usageTerms,
    notes: f.notes,
    documentPath: null,
    documentMimeType: opts.documentMeta?.mimeType ?? null,
    documentFileName: opts.documentMeta?.fileName ?? null,
    documentDataUrl: opts.documentMeta?.dataUrl ?? null,
    extractionRaw: { source: "buyme-import", title: gift.title },
    fieldsConfirmed: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function voucherFromBuyMeApiCard(
  card: BuyMeApiCard,
  opts: { userId?: string } = {},
): Voucher | null {
  const amountAgorot = shekelsToAgorot(card.balanceShekels);
  if (amountAgorot <= 0) return null;
  const now = new Date().toISOString();
  const expiryDate = card.expiresAt ? card.expiresAt.slice(0, 10) : null;
  return {
    id: crypto.randomUUID(),
    userId: opts.userId ?? DEMO_USER_ID,
    merchantId: null,
    merchantName: card.title,
    documentType: "shopping_voucher",
    status: "active",
    originalAmountAgorot: card.originalValueShekels
      ? shekelsToAgorot(card.originalValueShekels)
      : amountAgorot,
    remainingAmountAgorot: amountAgorot,
    currency: "ILS",
    issueDate: null,
    expiryDate,
    expiryConfidence: expiryDate ? "confirmed" : "missing",
    voucherCode: card.code,
    barcodeValue: card.barcode,
    usageTerms: card.supplierName
      ? `BuyMe · ${card.supplierName}`
      : "מימוש דרך BuyMe",
    notes: "יובא מארנק BuyMe המחובר",
    documentPath: null,
    documentMimeType: null,
    documentFileName: null,
    documentDataUrl: null,
    extractionRaw: {
      source: "buyme-siteapi",
      buymeId: card.id,
      url: card.url,
    },
    fieldsConfirmed: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function vouchersFromBuyMeGifts(
  gifts: BuyMeGiftCandidate[],
  opts?: Parameters<typeof voucherFromBuyMeGift>[1],
): { saved: Voucher[]; skipped: BuyMeGiftCandidate[] } {
  const saved: Voucher[] = [];
  const skipped: BuyMeGiftCandidate[] = [];
  for (const gift of gifts) {
    const v = voucherFromBuyMeGift(gift, opts);
    if (v) saved.push(v);
    else skipped.push(gift);
  }
  return { saved, skipped };
}

export function vouchersFromBuyMeApiCards(
  cards: BuyMeApiCard[],
  opts?: { userId?: string },
): { saved: Voucher[]; skipped: BuyMeApiCard[] } {
  const saved: Voucher[] = [];
  const skipped: BuyMeApiCard[] = [];
  for (const card of cards) {
    const v = voucherFromBuyMeApiCard(card, opts);
    if (v) saved.push(v);
    else skipped.push(card);
  }
  return { saved, skipped };
}

export function parseBuyMePageText(text: string): BuyMeGiftCandidate[] {
  return extractBuyMeGifts(text).filter(
    (g) => g.title !== "BuyMe" || g.amountAgorot != null,
  );
}

/**
 * Raw JS for the BuyMe tab console (Chrome blocks pasting `javascript:`
 * into the address bar). Reads Ember JWT and returns to our import route.
 */
export function buyMeBridgeConsoleScript(appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  const target = `${origin}${BUYME_IMPORT_PATH}`;
  return `(()=>{try{if(!/buyme\\.co\\.il/i.test(location.hostname)){alert("הריצו את זה בקונסול של החלון של BuyMe (אחרי התחברות)");return;}var raw=localStorage.getItem("ember_simple_auth-session");if(!raw){alert("עדיין לא מחוברים — התחברו ל־BuyMe ואז הדביקו שוב בקונסול");return;}var j=JSON.parse(raw);var t=(j&&j.authenticated&&j.authenticated.token)||(j&&j.token);if(!t||typeof t!=="string"){alert("לא נמצא חיבור פעיל ב־BuyMe");return;}location.href=${JSON.stringify(target)}+"#token="+encodeURIComponent(t);}catch(e){alert("שליחת החיבור מ־BuyMe נכשלה");}})();`;
}

/** @deprecated Prefer buyMeBridgeConsoleScript — address-bar javascript: is blocked in Chrome. */
export function buyMeBookmarkletHref(appOrigin: string): string {
  return `javascript:${encodeURIComponent(buyMeBridgeConsoleScript(appOrigin))}`;
}

/** Notify other same-origin windows that BuyMe session is ready. */
export function signalBuyMeConnected(): void {
  try {
    localStorage.setItem(BUYME_CONNECTED_STORAGE_KEY, String(Date.now()));
  } catch {
    /* private mode / blocked storage */
  }
}

export function readBuyMeImportHash(hash: string): {
  token: string | null;
  pageText: string | null;
} {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { token: null, pageText: null };
  try {
    if (raw.startsWith("token=")) {
      return { token: decodeURIComponent(raw.slice("token=".length)), pageText: null };
    }
    // Legacy: whole-page text dump
    return { token: null, pageText: decodeURIComponent(raw) };
  } catch {
    return { token: null, pageText: null };
  }
}
