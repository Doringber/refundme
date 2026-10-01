"use client";

import { useState, useSyncExternalStore } from "react";
import {
  BUYME_SITE_URL,
  buyMeBridgeConsoleScript,
} from "@/lib/buyme-import";

function subscribe() {
  return () => {};
}

export type BuyMeConnectCardProps = {
  /** Called after we open the BuyMe window — parent can show “waiting”. */
  onPopupOpened?: () => void;
};

/**
 * Temporary BuyMe window → sign in → paste bridge in that window’s
 * DevTools console → land back here with token → load wallet via API.
 *
 * Chrome strips `javascript:` from the address bar on paste, so we use the
 * console (reliable) instead of bookmarks / address-bar bookmarklets.
 */
export function BuyMeConnectCard({ onPopupOpened }: BuyMeConnectCardProps) {
  const script = useSyncExternalStore(
    subscribe,
    () => buyMeBridgeConsoleScript(window.location.origin),
    () => "",
  );
  const [opened, setOpened] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  async function copyBridge() {
    try {
      await navigator.clipboard.writeText(script);
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
      window.open(BUYME_SITE_URL, "_blank");
      setOpened(true);
      onPopupOpened?.();
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
          נפתח חלון זמני של BuyMe. אחרי ההתחברות מדביקים שם קוד קצר בקונסול
          (F12) — ואז הארנק נטען כאן אוטומטית.
        </p>
      </div>

      <button
        type="button"
        className="btn-primary flex w-full items-center justify-center py-3.5 text-sm"
        onClick={() => void openBuyMeWindow()}
        data-testid="buyme-open-popup"
      >
        {opened ? "החלון פתוח — המשיכו לפי השלבים" : "פתח חלון חיבור ל־BuyMe"}
      </button>

      {opened && (
        <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
          <p className="text-xs font-bold text-forest">בחלון של BuyMe</p>
          <ol className="list-decimal space-y-1.5 pe-5 text-[11px] font-semibold leading-relaxed text-eggplant">
            <li>התחברו (גוגל) ופתחו «המתנות שלי»</li>
            <li>
              לחצו <span className="whitespace-nowrap">F12</span> (במק:{" "}
              <span className="whitespace-nowrap">⌥⌘I</span>) → לשונית{" "}
              <span className="text-forest">Console</span>
            </li>
            <li>הדביקו (הקוד כבר מועתק) ולחצו Enter</li>
            <li>החלון יעבור לייבוא והארנק יופיע</li>
          </ol>
          <button
            type="button"
            className="btn-secondary w-full py-2.5 text-xs"
            onClick={() => void copyBridge()}
            data-testid="buyme-copy-bridge"
          >
            {copyState === "ok"
              ? "הקוד הועתק — הדביקו ב־Console בחלון BuyMe"
              : copyState === "fail"
                ? "ההעתקה נכשלה — נסו שוב"
                : "העתק שוב את קוד החיבור"}
          </button>
          <p className="text-[10px] leading-relaxed text-eggplant">
            למה קונסול? Chrome חוסם הדבקת javascript: בשורת הכתובת. הקונסול רץ
            בתוך BuyMe ולכן יכול לשלוח אלינו את החיבור בבטחה.
          </p>
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer BuyMeConnectCard — kept for existing imports. */
export { BuyMeConnectCard as BuyMeBookmarkCard };
