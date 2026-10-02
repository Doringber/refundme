"use client";

import { useEffect } from "react";
import { useAppData } from "@/lib/app-data/context";

const KEY = "zikuy:buyme-autosync-at";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/** On app open, refresh a stored BuyMe session at most once per 6 hours. */
export function BuyMeAutoSync() {
  const app = useAppData();
  useEffect(() => {
    if (app.mode !== "supabase" || !app.user) return;
    const last = Number(sessionStorage.getItem(KEY) || "0");
    if (Date.now() - last < SIX_HOURS_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    void fetch("/api/wallet/buyme/sync", { method: "POST" })
      .then(async (res) => {
        const json = (await res.json()) as { status?: string; upserted?: number };
        if (json.status === "synced" && (json.upserted ?? 0) > 0) {
          window.location.reload();
        }
      })
      .catch(() => {
        /* next open retries */
      });
  }, [app.mode, app.user]);
  return null;
}
