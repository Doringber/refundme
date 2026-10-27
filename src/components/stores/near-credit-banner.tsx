"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/lib/app-data/context";
import { lookupMallCredits, type MallHit } from "@/components/stores/mall-credits";

/**
 * Foreground check when a signed-in screen opens. One GPS fix if permission
 * is already granted or the browser asks once. Nothing runs in the background.
 */
export function NearCreditBanner() {
  const app = useAppData();
  const [hit, setHit] = useState<MallHit | null>(null);

  useEffect(() => {
    if (!app.ready) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        const permission = await navigator.permissions?.query({ name: "geolocation" });
        if (cancelled) return;
        // Opening the wallet may ask once. A previous denial stays quiet here;
        // the near-me screen explains how to allow it.
        if (permission?.state === "denied") return;
        const result = await lookupMallCredits(app.vouchers);
        if (cancelled || result.status !== "ready") return;
        setHit(result.hits[0] ?? null);
      } catch {
        /* The wallet stays quiet when location or the map is unavailable. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.ready, app.vouchers]);

  if (!hit) return null;
  return (
    <Link
      href="/stores/near"
      className="pressable mt-4 block rounded-2xl border-2 border-[#1c1c1c] bg-[var(--butter)] px-4 py-3 text-sm font-extrabold text-[#1c1c1c] shadow-[3px_3px_0_#1c1c1c]"
    >
      יש לך זיכוי כאן — {hit.place}
    </Link>
  );
}
