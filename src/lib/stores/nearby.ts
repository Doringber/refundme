import type { MerchantBranch, Voucher } from "@/lib/types";

/** Branches farther than this are not described as "באזור". */
export const NEARBY_RADIUS_KM = 25;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} ק״מ` : `${Math.round(km)} ק״מ`;
}

export function normalizeStoreName(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(left: string, right: string): boolean {
  const a = normalizeStoreName(left);
  const b = normalizeStoreName(right);
  if (a.length < 3 || b.length < 3) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function voucherMatchesBranch(
  voucher: Voucher,
  branch: MerchantBranch,
): boolean {
  if (voucher.merchantId && voucher.merchantId === branch.merchantId) return true;
  if (branch.merchantNameHe && namesMatch(voucher.merchantName, branch.merchantNameHe)) {
    return true;
  }
  return namesMatch(voucher.merchantName, branch.nameHe);
}

export function isRedeemableVoucher(voucher: Voucher): boolean {
  return (
    voucher.documentType !== "receipt" &&
    (voucher.status === "active" || voucher.status === "partially_redeemed") &&
    voucher.remainingAmountAgorot > 0
  );
}

export type NearbyCredit = {
  voucherId: string;
  merchantName: string;
  amountAgorot: number;
  nearestBranchName: string;
  distanceKm: number | null;
};

type LocatedBranch = MerchantBranch & { distanceKm: number | null };

function branchInArea(
  branch: LocatedBranch,
  opts: { hasLocation: boolean; city: string },
): boolean {
  if (branch.acceptance === "not_accepted") return false;
  if (opts.hasLocation) {
    return branch.distanceKm != null && branch.distanceKm <= NEARBY_RADIUS_KM;
  }
  if (opts.city) return branch.city === opts.city;
  return false;
}

/**
 * Spendable vouchers that match a branch in the selected city, or within
 * NEARBY_RADIUS_KM of a client-side location. One row per voucher.
 */
export function nearbyRedeemableCredits(
  branches: LocatedBranch[],
  vouchers: Voucher[],
  opts: { hasLocation: boolean; city: string },
): NearbyCredit[] {
  const area = branches.filter((branch) => branchInArea(branch, opts));
  const credits: NearbyCredit[] = [];
  for (const voucher of vouchers) {
    if (!isRedeemableVoucher(voucher)) continue;
    const matches = area.filter((branch) => voucherMatchesBranch(voucher, branch));
    if (!matches.length) continue;
    const nearest = [...matches].sort(
      (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999),
    )[0];
    credits.push({
      voucherId: voucher.id,
      merchantName: voucher.merchantName,
      amountAgorot: voucher.remainingAmountAgorot,
      nearestBranchName: nearest.nameHe,
      distanceKm: nearest.distanceKm,
    });
  }
  return credits.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
}
