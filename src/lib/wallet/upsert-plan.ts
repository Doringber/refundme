import { shekelsToAgorot } from "@/lib/calculations";
import type { NormalizedWalletItem } from "./types";

export type ExistingBuyMeVoucher = {
  id: string;
  externalId: string;
  voucherCode?: string | null;
  barcodeValue?: string | null;
  url?: string | null;
  shortToken?: string | null;
  supplierName?: string | null;
  supplierDescription?: string | null;
  redemptionInstructions?: string | null;
};

function preferText(
  next: string | null,
  previous: string | null | undefined,
): string | null {
  return next && next.trim() ? next : (previous ?? null);
}

export type VoucherWrite = {
  id?: string;
  merchant_name: string;
  document_type: "shopping_voucher";
  status: "active" | "fully_redeemed" | "expired";
  original_amount_agorot: number;
  remaining_amount_agorot: number;
  currency: "ILS";
  expiry_date: string | null;
  expiry_confidence: "confirmed" | "missing";
  voucher_code: string | null;
  barcode_value: string | null;
  usage_terms: string;
  notes: string;
  fields_confirmed: true;
  extraction_raw: {
    provider: "buyme";
    externalId: string;
    source: "buyme-sync";
    url: string | null;
    shortToken: string | null;
    supplierName: string | null;
    supplierDescription: string | null;
    redemptionInstructions: string | null;
  };
};

function mapStatus(status: NormalizedWalletItem["status"]): VoucherWrite["status"] {
  if (status === "used") return "fully_redeemed";
  if (status === "expired") return "expired";
  return "active";
}

export function voucherWriteFromItem(item: NormalizedWalletItem): VoucherWrite {
  const original = shekelsToAgorot(item.originalValueShekels);
  const remaining = Math.min(shekelsToAgorot(item.remainingValueShekels), original);
  return {
    merchant_name: item.merchant,
    document_type: "shopping_voucher",
    status: mapStatus(item.status),
    original_amount_agorot: original,
    remaining_amount_agorot: remaining,
    currency: "ILS",
    expiry_date: item.expiresAt,
    expiry_confidence: item.expiresAt ? "confirmed" : "missing",
    voucher_code: item.code,
    barcode_value: item.barcode,
    usage_terms: "מימוש דרך BuyMe",
    notes: "סונכרן אוטומטית מארנק BuyMe",
    fields_confirmed: true,
    extraction_raw: {
      provider: "buyme",
      externalId: item.externalId,
      source: "buyme-sync",
      url: item.url,
      shortToken: item.shortToken,
      supplierName: item.supplierName,
      supplierDescription: item.supplierDescription,
      redemptionInstructions: item.redemptionInstructions,
    },
  };
}

export function planBuyMeUpserts(
  existing: ExistingBuyMeVoucher[],
  items: NormalizedWalletItem[],
): { inserts: VoucherWrite[]; updates: Array<VoucherWrite & { id: string }> } {
  const byExternal = new Map(existing.map((row) => [row.externalId, row]));
  const inserts: VoucherWrite[] = [];
  const updates: Array<VoucherWrite & { id: string }> = [];
  const seenExternalIds = new Set<string>();
  for (const item of items) {
    if (item.provider !== "buyme") continue;
    if (seenExternalIds.has(item.externalId)) continue;
    seenExternalIds.add(item.externalId);
    const row = voucherWriteFromItem(item);
    const prev = byExternal.get(item.externalId);
    if (prev) {
      updates.push({
        ...row,
        id: prev.id,
        voucher_code: preferText(row.voucher_code, prev.voucherCode),
        barcode_value: preferText(row.barcode_value, prev.barcodeValue),
        extraction_raw: {
          ...row.extraction_raw,
          url: preferText(row.extraction_raw.url, prev.url),
          shortToken: preferText(row.extraction_raw.shortToken, prev.shortToken),
          supplierName: preferText(row.extraction_raw.supplierName, prev.supplierName),
          supplierDescription: preferText(
            row.extraction_raw.supplierDescription,
            prev.supplierDescription,
          ),
          redemptionInstructions: preferText(
            row.extraction_raw.redemptionInstructions,
            prev.redemptionInstructions,
          ),
        },
      });
    } else {
      inserts.push(row);
    }
  }
  return { inserts, updates };
}
