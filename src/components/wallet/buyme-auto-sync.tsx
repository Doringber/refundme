"use client";

import { useEffect } from "react";
import { useAppData } from "@/lib/app-data/context";
import {
  captureBuyMeFromExtension,
  detectBuyMeExtension,
} from "@/lib/buyme/extension-client";

const KEY = "zikuy:buyme-autosync-at";
const ATTEMPT = "zikuy:buyme-capture-attempt";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function imported(report: { status?: string; upserted?: number; fetched?: number }): boolean {
  return report.status === "synced" && ((report.fetched ?? 0) > 0 || (report.upserted ?? 0) > 0);
}

/**
 * On app open: if the Chrome extension is installed, read the BuyMe session
 * already in this browser and import. Otherwise refresh a stored session at
 * most once per 6 hours. A failed capture is not treated as a successful sync.
 */
export function BuyMeAutoSync() {
  const app = useAppData();
  useEffect(() => {
    if (app.mode !== "supabase" || !app.user) return;
    const last = Number(sessionStorage.getItem(KEY) || "0");
    if (Date.now() - last < SIX_HOURS_MS) return;

    let cancelled = false;
    void (async () => {
      const installed = await detectBuyMeExtension();
      if (cancelled) return;
      if (installed && !sessionStorage.getItem(ATTEMPT)) {
        sessionStorage.setItem(ATTEMPT, "1");
        const captured = await captureBuyMeFromExtension({ interactive: false });
        if (cancelled) return;
        if (imported(captured.sync ?? {})) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return;
        }
        if (captured.sync?.status === "synced") {
          sessionStorage.setItem(KEY, String(Date.now()));
          return;
        }
      }

      const res = await fetch("/api/wallet/buyme/sync", { method: "POST" });
      const json = (await res.json()) as {
        status?: string;
        upserted?: number;
        fetched?: number;
      };
      if (cancelled) return;
      if (json.status === "synced") {
        sessionStorage.setItem(KEY, String(Date.now()));
        if (imported(json)) window.location.reload();
      }
    })().catch(() => {
      /* next open retries */
    });

    return () => {
      cancelled = true;
    };
  }, [app.mode, app.user]);
  return null;
}
