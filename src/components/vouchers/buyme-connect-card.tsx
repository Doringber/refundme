"use client";

import { useState, useSyncExternalStore } from "react";
import {
  BUYME_SITE_URL,
  buyMeBookmarkletHref,
} from "@/lib/buyme-import";

function subscribe() {
  return () => {};
}

export type BuyMeConnectCardProps = {
  /** Called after we open the BuyMe window — parent can show “waiting”. */
  onPopupOpened?: () => void;
};

/**
 * Temporary BuyMe window → sign in → paste connect step in that window’s
 * address bar → token saved → continue with API.
 *
 * No bookmarks bar. Browsers block reading BuyMe storage from our origin,
 * so the connect script must run inside the BuyMe window (paste + Enter).
 */
export function BuyMeConnectCard({ onPopupOpened }: BuyMeConnectCardProps) {
  const href = useSyncExternalStore(
    subscribe,
    () => buyMeBookmarkletHref(window.location.origin),
    () => "#",
  );
  const [opened, setOpened] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  async function copyBridge() {
    try {
      await navigator.clipboard.writeText(href);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 2500);
      return true;
    } catch {
      setCopyState("fail");
      return false;
    }
  }

  async function openBuyMeWindow() {
    await copyBridge();
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
    setOpened(true);
    onPopupOpened?.();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">חיבור ל־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          נפתח חלון זמני של BuyMe. אחרי ההתחברות שם — מדביקים בשורת הכתובת
          (כבר מועתק) ולוחצים Enter. החיבור נשמר והחלון חוזר אלינו.
        </p>
      </div>

      <button
        type="button"
        className="btn-primary flex w-full items-center justify-center py-3.5 text-sm"
        onClick={() => void openBuyMeWindow()}
        data-testid="buyme-open-popup"
      >
        {opened ? "החלון פתוח — התחברו ב־BuyMe" : "פתח חלון חיבור ל־BuyMe"}
      </button>

      {opened && (
        <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
          <p className="text-xs font-bold text-forest">בחלון של BuyMe</p>
          <ol className="list-decimal space-y-1 pe-5 text-[11px] font-semibold leading-relaxed text-eggplant">
            <li>התחברו (גוגל) ופתחו «המתנות שלי»</li>
            <li>
              לחצו על שורת הכתובת ← הדביקו (
              <span className="whitespace-nowrap">Ctrl+V</span> /{" "}
              <span className="whitespace-nowrap">⌘V</span>) ← Enter
            </li>
            <li>החלון נסגר / חוזר לכאן והארנק נטען</li>
          </ol>
          <button
            type="button"
            className="btn-secondary w-full py-2.5 text-xs"
            onClick={() => void copyBridge()}
            data-testid="buyme-copy-bridge"
          >
            {copyState === "ok"
              ? "הועתק שוב — הדביקו בשורת הכתובת בחלון BuyMe"
              : copyState === "fail"
                ? "ההעתקה נכשלה — נסו שוב"
                : "העתק שוב את שלב החיבור"}
          </button>
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer BuyMeConnectCard — kept for existing imports. */
export { BuyMeConnectCard as BuyMeBookmarkCard };
