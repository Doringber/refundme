import { catalogForVoucher } from "@/lib/stores/lookup";
import { isRedeemableVoucher } from "@/lib/stores/nearby";
import { parseNearbyPayload } from "@/lib/stores/search";
import type { Voucher } from "@/lib/types";

/** A mall corridor, not a neighborhood. */
export const MALL_KM = 0.3;
const STORAGE_KEY = "zikuy-mall-credits";
const FRESH_MS = 30 * 60 * 1000;

export type MallHit = {
  place: string;
  voucherId: string;
  merchantName: string;
};

type Cached = { at: number; hits: MallHit[] };

export type MallLookup =
  | { status: "ready"; hits: MallHit[] }
  | { status: "empty" | "denied" | "unavailable" };

function readCache(): MallHit[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (!parsed || !Array.isArray(parsed.hits) || Date.now() - parsed.at > FRESH_MS) return null;
    return parsed.hits;
  } catch {
    return null;
  }
}

function writeCache(hits: MallHit[]) {
  try {
    const payload: Cached = { at: Date.now(), hits };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* Private mode can refuse session storage. The list still renders. */
  }
}

async function position(fresh: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: fresh ? 0 : 60_000,
    });
  });
}

async function placesFor(body: unknown): Promise<Array<{ name: string; distanceKm: number | null }>> {
  return parseNearbyPayload({ contentType: "application/json", body }).places;
}

/**
 * One precise GPS fix, then credits that can be spent within {@link MALL_KM}.
 * No watch. A denied prompt stays denied until the page asks again.
 */
export async function lookupMallCredits(
  vouchers: Voucher[],
  options: { fresh?: boolean } = {},
): Promise<MallLookup> {
  const spendable = vouchers.filter(isRedeemableVoucher);
  if (!spendable.length) return { status: "empty" };
  if (!options.fresh) {
    const cached = readCache();
    if (cached) return cached.length ? { status: "ready", hits: cached } : { status: "empty" };
  }
  if (!window.isSecureContext || !navigator.geolocation) return { status: "unavailable" };
  let pos: GeolocationPosition;
  try {
    pos = await position(Boolean(options.fresh));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? Number(error.code) : 0;
    return { status: code === 1 ? "denied" : "unavailable" };
  }
  const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const catalogs = new Map<string, Voucher>();
  const singles: Voucher[] = [];
  for (const voucher of spendable) {
    const catalog = catalogForVoucher(voucher);
    if (catalog) {
      if (!catalogs.has(catalog.id)) catalogs.set(catalog.id, voucher);
    } else {
      singles.push(voucher);
    }
  }
  const hits: MallHit[] = [];
  const seen = new Set<string>();
  const take = (
    places: Array<{ name: string; distanceKm: number | null }>,
    voucher: Voucher,
  ) => {
    for (const place of places) {
      if (place.distanceKm == null || place.distanceKm > MALL_KM) continue;
      const key = `${voucher.id}:${place.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        place: place.name,
        voucherId: voucher.id,
        merchantName: voucher.merchantName,
      });
    }
  };
  try {
    if (catalogs.size) {
      const res = await fetch("/api/stores/nearby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: origin.lat,
          lng: origin.lng,
          catalogIds: [...catalogs.keys()],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const body = (res.headers.get("content-type")?.includes("json")
        ? await res.json()
        : null) as { catalogs?: Record<string, unknown> } | null;
      for (const [id, voucher] of catalogs) {
        take(await placesFor(body?.catalogs?.[id]), voucher);
      }
    }
    for (const voucher of singles.slice(0, 4)) {
      const res = await fetch("/api/stores/nearby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: origin.lat,
          lng: origin.lng,
          merchantName: voucher.merchantName,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
      take(await placesFor(body), voucher);
    }
  } catch {
    return { status: "unavailable" };
  }
  hits.sort((a, b) => a.place.localeCompare(b.place, "he"));
  const next = hits.slice(0, 8);
  if (!options.fresh) writeCache(next);
  return next.length ? { status: "ready", hits: next } : { status: "empty" };
}
