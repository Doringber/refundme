import {
  EXPIRY_UPCOMING_DAYS,
  EXPIRY_URGENT_DAYS,
  SPENDABLE_TYPES,
} from "./constants";
import type {
  DashboardSummary,
  ExpiryConfidence,
  UrgencyLevel,
  Voucher,
  VoucherFilters,
} from "./types";

export function formatIls(agorot: number): string {
  const shekels = agorot / 100;
  const formatted = new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: shekels % 1 === 0 ? 0 : 2,
    minimumFractionDigits: shekels % 1 === 0 ? 0 : 2,
  }).format(shekels);
  return `₪${formatted}`;
}

export function shekelsToAgorot(shekels: number): number {
  return Math.round(shekels * 100);
}

export function agorotToShekels(agorot: number): number {
  return agorot / 100;
}

export function parseShekelInput(value: string): number | null {
  const normalized = value.replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return shekelsToAgorot(n);
}

export function isSpendable(voucher: Voucher): boolean {
  return (
    SPENDABLE_TYPES.includes(voucher.documentType) &&
    voucher.fieldsConfirmed &&
    (voucher.status === "active" || voucher.status === "partially_redeemed") &&
    voucher.remainingAmountAgorot > 0
  );
}

export function daysUntil(dateIso: string | null, today = new Date()): number | null {
  if (!dateIso) return null;
  const target = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  const diffMs = target.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function expiryUrgency(
  expiryDate: string | null,
  confidence: ExpiryConfidence,
  today = new Date(),
): UrgencyLevel {
  if (confidence !== "confirmed" || !expiryDate) return "none";
  const days = daysUntil(expiryDate, today);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= EXPIRY_URGENT_DAYS) return "urgent";
  if (days <= EXPIRY_UPCOMING_DAYS) return "upcoming";
  return "none";
}

export function remainingFromRedemptions(
  originalAgorot: number,
  redeemedAgorot: number,
): number {
  return Math.max(0, originalAgorot - redeemedAgorot);
}

export function filterVouchers(
  vouchers: Voucher[],
  filters: VoucherFilters,
): Voucher[] {
  return vouchers.filter((v) => {
    if (filters.query) {
      const q = filters.query.trim().toLowerCase();
      const hay = [
        v.merchantName,
        v.voucherCode ?? "",
        v.barcodeValue ?? "",
        v.usageTerms ?? "",
        v.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.merchant && filters.merchant !== "all") {
      if (v.merchantName !== filters.merchant) return false;
    }
    if (filters.documentType && filters.documentType !== "all") {
      if (v.documentType !== filters.documentType) return false;
    }
    if (filters.status && filters.status !== "all") {
      if (v.status !== filters.status) return false;
    }
    if (filters.expiryBefore && v.expiryDate) {
      if (v.expiryDate > filters.expiryBefore) return false;
    }
    if (filters.expiryAfter && v.expiryDate) {
      if (v.expiryDate < filters.expiryAfter) return false;
    }
    return true;
  });
}

export function buildDashboardSummary(
  vouchers: Voucher[],
  activity: DashboardSummary["recentActivity"],
  today = new Date(),
): DashboardSummary {
  const spendable = vouchers.filter(isSpendable);
  const totalActiveCreditAgorot = spendable.reduce(
    (sum, v) => sum + v.remainingAmountAgorot,
    0,
  );

  const withConfirmedExpiry = spendable
    .filter((v) => v.expiryConfidence === "confirmed" && v.expiryDate)
    .map((v) => ({ voucher: v, days: daysUntil(v.expiryDate, today)! }))
    .filter((x) => x.days !== null)
    .sort((a, b) => a.days - b.days);

  const nearest = withConfirmedExpiry[0] ?? null;

  const merchantMap = new Map<
    string,
    { merchantName: string; totalAgorot: number; count: number }
  >();
  for (const v of spendable) {
    const cur = merchantMap.get(v.merchantName) ?? {
      merchantName: v.merchantName,
      totalAgorot: 0,
      count: 0,
    };
    cur.totalAgorot += v.remainingAmountAgorot;
    cur.count += 1;
    merchantMap.set(v.merchantName, cur);
  }

  const expiringSoon = withConfirmedExpiry
    .filter((x) => x.days <= EXPIRY_UPCOMING_DAYS)
    .map((x) => x.voucher);

  return {
    totalActiveCreditAgorot,
    nearestExpiring: nearest?.voucher ?? null,
    daysUntilNearestExpiry: nearest?.days ?? null,
    merchantBreakdown: [...merchantMap.values()].sort(
      (a, b) => b.totalAgorot - a.totalAgorot,
    ),
    expiringSoon,
    recentActivity: activity.slice(0, 8),
    vouchers,
  };
}

export type ExpiryTone = "calm" | "soon" | "now" | "unknown";

/** Short, number-free label for the on-screen expiry meter. */
export function expiryIndicatorLabel(
  expiryDate: string | null,
  confidence: ExpiryConfidence,
  today = new Date(),
): { label: string; tone: ExpiryTone } {
  if (confidence !== "confirmed" || !expiryDate) {
    return { label: "תוקף לא אומת", tone: "unknown" };
  }
  const days = daysUntil(expiryDate, today);
  if (days === null) return { label: "תוקף לא אומת", tone: "unknown" };
  if (days < 0) return { label: "התוקף עבר", tone: "now" };
  if (days === 0) return { label: "פג היום", tone: "now" };
  if (days === 1) return { label: "פג מחר", tone: "now" };
  if (days <= EXPIRY_URGENT_DAYS) return { label: "עוד רגע", tone: "now" };
  if (days <= EXPIRY_UPCOMING_DAYS) return { label: "בקרוב", tone: "soon" };
  return { label: "יש זמן", tone: "calm" };
}

export function expiryMessage(voucher: Voucher | null, days: number | null): string {
  if (!voucher) return "אין זיכויים עם תוקף מאומת";
  if (voucher.expiryConfidence !== "confirmed" || !voucher.expiryDate) {
    return "תוקף לא אומת — בדקו את המסמך";
  }
  if (days === null) return "תוקף לא אומת — בדקו את המסמך";
  if (days < 0) {
    return `הזיכוי ב־${voucher.merchantName} פג תוקף`;
  }
  if (days === 0) {
    return `הזיכוי ב־${voucher.merchantName} פג היום`;
  }
  if (days === 1) {
    return `זיכוי ב־${voucher.merchantName} פג מחר`;
  }
  return `זיכוי ב־${voucher.merchantName} פג בעוד ${days} ימים`;
}
