"use client";

import { useEffect } from "react";
import { useAppData } from "@/lib/app-data/context";
import { runExpiryNotificationPass } from "@/lib/notifications/expiry-alerts";

/**
 * Quietly checks spendable vouchers against reminderDays and shows
 * browser notifications when permission + settings allow it.
 */
export function ExpiryNotifier() {
  const app = useAppData();

  useEffect(() => {
    if (!app.ready) return;

    const run = () => {
      runExpiryNotificationPass(app.vouchers, app.profile.reminderDays);
    };

    // First pass shortly after data is ready (avoid competing with hydration)
    const t = window.setTimeout(run, 1_200);

    // Re-check when tab becomes visible again (e.g. next morning)
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);

    // Lightweight poll while app stays open
    const interval = window.setInterval(run, 30 * 60 * 1000);

    return () => {
      window.clearTimeout(t);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [app.ready, app.vouchers, app.profile.reminderDays]);

  return null;
}
