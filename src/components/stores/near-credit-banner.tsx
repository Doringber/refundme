"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/lib/app-data/context";
import { catalogForVoucher } from "@/lib/stores/lookup";
import { isRedeemableVoucher } from "@/lib/stores/nearby";
import { parseNearbyPayload } from "@/lib/stores/search";

/** Walkable distance: a mall corridor or the block outside it. */
const NEAR_KM = 0.8;
const STORAGE_KEY = "zikuy-near-banner";
const FRESH_MS = 30 * 60 * 1000;

type Hit = { name: string; at: number };

function readHit(): Hit | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Hit;
    if (!parsed?.name || Date.now() - parsed.at > FRESH_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Foreground check when the wallet opens and location permission was already
 * granted. No prompt, no background watch. iOS will not run this while the
 * app is closed.
 */
export function NearCreditBanner() {
  const app = useAppData();
  const [hit, setHit] = useState<Hit | null>(null);

  useEffect(() => {
    if (!app.ready) return;
    const spendable = app.vouchers.filter(isRedeemableVoucher);
    if (!spendable.length) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const stored = readHit();
      if (stored) {
        setHit(stored);
        return;
      }
      try {
        const permission = await navigator.permissions?.query({ name: "geolocation" });
        if (cancelled || permission?.state !== "granted" || !window.isSecureContext) return;
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8_000,
            maximumAge: FRESH_MS,
          });
        });
        if (cancelled) return;
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const catalogIds = [
          ...new Set(
            spendable.flatMap((voucher) => {
              const id = catalogForVoucher(voucher)?.id;
              return id ? [id] : [];
            }),
          ),
        ];
        const merchants = [
          ...new Set(
            spendable
              .filter((voucher) => !catalogForVoucher(voucher))
              .map((voucher) => voucher.merchantName),
          ),
        ].slice(0, 4);
        const found: Array<{ name: string; km: number }> = [];
        const collect = (places: Array<{ name: string; distanceKm: number | null }>) => {
          for (const place of places) {
            if (place.distanceKm != null && place.distanceKm <= NEAR_KM) {
              found.push({ name: place.name, km: place.distanceKm });
            }
          }
        };
        if (catalogIds.length) {
          const res = await fetch("/api/stores/nearby", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lat: origin.lat, lng: origin.lng, catalogIds }),
            signal: AbortSignal.timeout(9_500),
          });
          const contentType = res.headers.get("content-type");
          const body = (contentType?.includes("json") ? await res.json() : null) as {
            catalogs?: Record<string, unknown>;
          } | null;
          for (const id of catalogIds) {
            collect(parseNearbyPayload({ contentType, body: body?.catalogs?.[id] }).places);
          }
        }
        for (const merchantName of merchants) {
          const res = await fetch("/api/stores/nearby", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lat: origin.lat, lng: origin.lng, merchantName }),
            signal: AbortSignal.timeout(9_500),
          });
          const contentType = res.headers.get("content-type");
          const body = contentType?.includes("json") ? await res.json() : null;
          collect(parseNearbyPayload({ contentType, body }).places);
        }
        if (cancelled) return;
        found.sort((a, b) => a.km - b.km);
        const nearest = found[0];
        if (!nearest) return;
        const next = { name: nearest.name, at: Date.now() };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setHit(next);
      } catch {
        /* Closed app, denied location, or a slow map: the wallet stays quiet. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.ready, app.vouchers]);

  if (!hit) return null;
  return (
    <Link
      href="/stores"
      className="mt-4 block rounded-2xl bg-[var(--butter)] px-4 py-3 text-sm font-extrabold text-[#1c1c1c]"
    >
      יש זיכוי לידך — {hit.name}
    </Link>
  );
}
