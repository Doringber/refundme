"use client";

import { useState, useSyncExternalStore } from "react";
import {
  BUYME_SITE_URL,
  buyMeBookmarkletHref,
  buyMeBridgeConsoleScript,
} from "@/lib/buyme-import";

function subscribe() {
  return () => {};
}

function useIsCoarsePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(pointer: coarse)").matches
        : false,
    () => false,
  );
}

export type BuyMeConnectCardProps = {
  /** Called after we open BuyMe — parent can show “waiting”. */
  onPopupOpened?: () => void;
};

/**
 * Mobile: save a one-tap connect bookmark, open BuyMe, tap the bookmark.
 * Desktop: same bookmark, or paste bridge script in the BuyMe console
 * (Chrome blocks `javascript:` in the address bar).
 */
export function BuyMeConnectCard({ onPopupOpened }: BuyMeConnectCardProps) {
  const isPhone = useIsCoarsePointer();
  const bookmarkHref = useSyncExternalStore(
    subscribe,
    () => buyMeBookmarkletHref(window.location.origin),
    () => "#",
  );
  const consoleScript = useSyncExternalStore(
    subscribe,
    () => buyMeBridgeConsoleScript(window.location.origin),
    () => "",
  );
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState<"idle" | "bookmark" | "console" | "fail">(
    "idle",
  );

  async function copyText(text: string, kind: "bookmark" | "console") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied("idle"), 2500);
      return true;
    } catch {
      setCopied("fail");
      return false;
    }
  }

  function openBuyMe() {
    const win = window.open(BUYME_SITE_URL, "buyme_connect");
    if (!win) {
      // Mobile often blocks window.open — navigate this tab.
      window.location.assign(BUYME_SITE_URL);
      return;
    }
    try {
      win.focus();
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
          {isPhone
            ? "בטלפון: שומרים כפתור חיבור לסימניות → נכנסים ל־BuyMe → לוחצים על הכפתור → הארנק מגיע."
            : "נפתח BuyMe להתחברות, ואז לחיצה אחת מחזירה את החיבור לכאן והארנק נטען."}
        </p>
      </div>

      {/* Step 1 — save connect control (required on phone; no DevTools) */}
      <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
        <p className="text-xs font-bold text-forest">1. שמירת כפתור החיבור</p>
        <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
          {isPhone
            ? "לחצו «העתק כפתור» → בSafari/Chrome: סימניות ← סימנייה חדשה ← הדביקו בכתובת ← שמרו בשם «חיבור BuyMe»."
            : "גררו את הכפתור לשורת הסימניות, או העתיקו והדביקו כסימנייה חדשה."}
        </p>
        <a
          href={bookmarkHref}
          className="btn-secondary flex w-full items-center justify-center py-2.5 text-xs"
          onClick={(e) => {
            e.preventDefault();
            void copyText(bookmarkHref, "bookmark");
          }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/uri-list", bookmarkHref);
            e.dataTransfer.setData("text/plain", bookmarkHref);
          }}
          data-testid="buyme-bookmarklet"
        >
          {copied === "bookmark"
            ? "הועתק — הדביקו כסימנייה בשם «חיבור BuyMe»"
            : copied === "fail"
              ? "ההעתקה נכשלה — נסו שוב"
              : isPhone
                ? "העתק כפתור חיבור"
                : "גררו לסימניות · או העתיקו"}
        </a>
      </div>

      {/* Step 2 — open BuyMe */}
      <button
        type="button"
        className="btn-primary flex w-full items-center justify-center py-3.5 text-sm"
        onClick={openBuyMe}
        data-testid="buyme-open-popup"
      >
        {opened ? "2. BuyMe פתוח — התחברו שם" : "2. פתח את BuyMe והתחברו"}
      </button>

      {opened && (
        <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
          <p className="text-xs font-bold text-forest">3. שליחת החיבור</p>
          {isPhone ? (
            <ol className="list-decimal space-y-1.5 pe-5 text-[11px] font-semibold leading-relaxed text-eggplant">
              <li>התחברו ב־BuyMe ופתחו «המתנות שלי»</li>
              <li>פתחו סימניות ולחצו על «חיבור BuyMe»</li>
              <li>תחזרו לכאן עם הארנק מלא</li>
            </ol>
          ) : (
            <>
              <ol className="list-decimal space-y-1.5 pe-5 text-[11px] font-semibold leading-relaxed text-eggplant">
                <li>התחברו ופתחו «המתנות שלי»</li>
                <li>לחצו על הסימנייה «חיבור BuyMe»</li>
                <li>או: F12 → Console → הדביקו את קוד החיבור → Enter</li>
              </ol>
              <button
                type="button"
                className="btn-secondary w-full py-2.5 text-xs"
                onClick={() => void copyText(consoleScript, "console")}
                data-testid="buyme-copy-bridge"
              >
                {copied === "console"
                  ? "קוד הקונסול הועתק"
                  : "העתק קוד ל־Console (דסקטופ)"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer BuyMeConnectCard — kept for existing imports. */
export { BuyMeConnectCard as BuyMeBookmarkCard };
