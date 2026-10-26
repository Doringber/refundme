"use client";

import { useSyncExternalStore } from "react";
import { BUYME_SITE_URL, buyMeBookmarkletHref } from "@/lib/buyme-import";

function subscribe() {
  return () => {};
}

/**
 * Existing BuyMe connect: open the site and copy the bridge that returns
 * the user's own session token. Settings is the only screen that shows this.
 */
export function BuyMeConnectCard({
  label,
  variant = "primary",
  onOpened,
}: {
  label: string;
  variant?: "primary" | "secondary";
  onOpened?: (copied: boolean) => void;
}) {
  const href = useSyncExternalStore(
    subscribe,
    () => buyMeBookmarkletHref(window.location.origin),
    () => "",
  );

  async function openBuyMeWindow() {
    let copied = false;
    if (href) {
      try {
        await navigator.clipboard.writeText(href);
        copied = true;
      } catch {
        copied = false;
      }
    }
    const popup = window.open(
      BUYME_SITE_URL,
      "buyme_connect",
      "popup=yes,width=490,height=780",
    );
    if (!popup) {
      window.location.assign(BUYME_SITE_URL);
      return;
    }
    try {
      popup.focus();
    } catch {
      /* ignore */
    }
    onOpened?.(copied);
  }

  return (
    <button
      type="button"
      className={`${variant === "primary" ? "btn-primary" : "btn-secondary"} px-5 py-3 text-sm`}
      onClick={() => void openBuyMeWindow()}
      data-testid="buyme-open-popup"
    >
      {label}
    </button>
  );
}
