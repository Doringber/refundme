import { buyMeHttpsUrl } from "@/lib/buyme/url";
import type { Voucher } from "@/lib/types";

export type CheckoutKind = "code" | "buyme" | "document" | "none";

export function voucherCodeInputError(code: string): string | null {
  const trimmed = code.trim();
  if (trimmed.length < 4 || trimmed.length > 80) {
    return "הזינו קוד שובר (4–80 תווים)";
  }
  if (/[\r\n]/.test(trimmed)) return "הקוד לא יכול לכלול שורות";
  return null;
}

/** Explicit BuyMe link stored on the voucher. Never invented from an id. */
export function buyMeOpenUrl(
  voucher: Pick<Voucher, "extractionRaw">,
): string | null {
  const raw = voucher.extractionRaw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const fromBuyMe =
    record.provider === "buyme" ||
    record.source === "buyme-import" ||
    record.source === "buyme-sync" ||
    record.source === "buyme-review";
  if (!fromBuyMe && typeof record.url !== "string") return null;
  return buyMeHttpsUrl(record.url);
}

export function checkoutKind(voucher: Voucher): CheckoutKind {
  if (voucher.voucherCode?.trim() || voucher.barcodeValue?.trim()) return "code";
  if (buyMeOpenUrl(voucher)) return "buyme";
  if (voucher.documentDataUrl || voucher.documentPath) return "document";
  return "none";
}

/** Full-screen checkout is only useful when there is a code, a BuyMe link, or a document. */
export function offerCheckoutDisplay(voucher: Voucher): boolean {
  if (voucher.documentType === "receipt") return false;
  if (voucher.status !== "active" && voucher.status !== "partially_redeemed") {
    return false;
  }
  if (voucher.remainingAmountAgorot <= 0) return false;
  return checkoutKind(voucher) !== "none";
}
