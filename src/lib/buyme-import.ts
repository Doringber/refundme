import type { BuyMeGiftCandidate } from "./extract-buyme";
import { extractBuyMeGifts } from "./extract-buyme";
import { DEMO_USER_ID } from "./demo/data";
import type { Voucher } from "./types";

export const BUYME_IMPORT_PATH = "/vouchers/import/buyme";

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
    barcodeValue: null,
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

export function parseBuyMePageText(text: string): BuyMeGiftCandidate[] {
  return extractBuyMeGifts(text).filter(
    (g) => g.title !== "BuyMe" || g.amountAgorot != null,
  );
}

/**
 * Bookmarklet that runs on buyme.co.il — acts as a "button on BuyMe":
 * copies page text and jumps into our import screen.
 */
export function buyMeBookmarkletHref(appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  const target = `${origin}${BUYME_IMPORT_PATH}`;
  const code = `(()=>{try{if(!/buyme\\.co\\.il/i.test(location.hostname)){alert("פתחו קודם את «המתנות שלי» ב־BuyMe (buyme.co.il)");return;}var t=(document.body&&document.body.innerText)||"";if(!t.trim()){alert("לא נמצא טקסט בעמוד");return;}location.href=${JSON.stringify(target)}+"#"+encodeURIComponent(t.slice(0,80000));}catch(e){alert("הייבוא נכשל");}})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

export function readBuyMeImportHash(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}
