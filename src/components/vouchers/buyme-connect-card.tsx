"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  BUYME_SITE_URL,
  buyMeBookmarkletHref,
  buyMeBridgeConsoleScript,
  parseBuyMePageText,
} from "@/lib/buyme-import";
import type { BuyMeGiftCandidate } from "@/lib/extract-buyme";

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
  /** Open the device camera/gallery for a «המתנות שלי» screenshot. */
  onPickScreenshot?: () => void;
  /** Parsed gifts from pasted list text. */
  onParsedText?: (gifts: BuyMeGiftCandidate[]) => void;
  screenshotBusy?: boolean;
};

/**
 * Mobile-first BuyMe import. Screenshot + paste work on phones.
 * API/bookmark connect is desktop-only — iOS/Android block javascript: bookmarks.
 */
export function BuyMeConnectCard({
  onPickScreenshot,
  onParsedText,
  screenshotBusy = false,
}: BuyMeConnectCardProps) {
  const isPhone = useIsCoarsePointer();
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [showDesktopApi, setShowDesktopApi] = useState(false);

  function openBuyMe() {
    const win = window.open(BUYME_SITE_URL, "_blank");
    if (!win) window.location.assign(BUYME_SITE_URL);
  }

  function submitPaste() {
    setPasteError(null);
    const gifts = parseBuyMePageText(paste);
    if (!gifts.length) {
      setPasteError(
        "לא מצאנו מתנות עם יתרה בטקסט. העתיקו מ־BuyMe את רשימת «המתנות שלי» (כולל המילים יתרה / ₪).",
      );
      return;
    }
    onParsedText?.(gifts);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">ייבוא מ־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          בטלפון הכי פשוט: צילום מסך אחד של «המתנות שלי», או הדבקת הטקסט מהרשימה.
        </p>
      </div>

      <button
        type="button"
        className="btn-secondary w-full py-2.5 text-xs"
        onClick={openBuyMe}
        data-testid="buyme-open-site"
      >
        פתח את BuyMe (להתחברות / צילום)
      </button>

      {onPickScreenshot && (
        <button
          type="button"
          className="btn-primary flex w-full flex-col items-center gap-1 py-3.5 text-sm"
          disabled={screenshotBusy}
          onClick={onPickScreenshot}
          data-testid="buyme-import-button"
        >
          <span className="font-extrabold">צילום «המתנות שלי»</span>
          <span className="text-xs opacity-90">
            ייבוא כל המתנות עם יתרה — עובד בטלפון
          </span>
        </button>
      )}

      {onParsedText && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-forest" htmlFor="buyme-paste">
            או הדביקו טקסט מהרשימה
          </label>
          <textarea
            id="buyme-paste"
            className="min-h-28 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-forest placeholder:text-eggplant/70"
            placeholder={"לדוגמה:\nBUYME ALL\nיתרה: ₪881\n..."}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            data-testid="buyme-paste-text"
          />
          <button
            type="button"
            className="btn-secondary w-full py-2.5 text-xs"
            disabled={!paste.trim()}
            onClick={submitPaste}
            data-testid="buyme-parse-paste"
          >
            ייבוא מהטקסט שהודבק
          </button>
          {pasteError && (
            <p className="text-xs font-semibold text-[rgb(180,60,40)]" role="alert">
              {pasteError}
            </p>
          )}
        </div>
      )}

      {!isPhone && (
        <details
          className="rounded-xl bg-white/10 px-3 py-2"
          open={showDesktopApi}
          onToggle={(e) => setShowDesktopApi((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-xs font-bold text-forest">
            במחשב בלבד: חיבור API (ניסיוני)
          </summary>
          <DesktopApiConnect />
        </details>
      )}

      {isPhone && (
        <p className="text-[10px] leading-relaxed text-eggplant">
          חיבור API עם סימנייה לא יציב באייפון/אנדרואיד (הדפדפן חוסם). לכן בטלפון
          משתמשים בצילום או בהדבקת טקסט.
        </p>
      )}
    </div>
  );
}

function DesktopApiConnect() {
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
  const [copied, setCopied] = useState<"idle" | "bookmark" | "console" | "fail">(
    "idle",
  );

  async function copyText(text: string, kind: "bookmark" | "console") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied("idle"), 2500);
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="mt-2 space-y-2 text-[11px] font-semibold leading-relaxed text-eggplant">
      <p>
        אחרי התחברות ב־BuyMe: סימנייה «חיבור BuyMe», או F12 → Console → הדבקה.
        אחר כך נטען הארנק (כולל קודים) דרך ה־API.
      </p>
      <a
        href={bookmarkHref}
        className="btn-secondary flex w-full items-center justify-center py-2 text-xs"
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
        {copied === "bookmark" ? "הועתק לסימנייה" : "העתק / גרור סימניית חיבור"}
      </a>
      <button
        type="button"
        className="btn-secondary w-full py-2 text-xs"
        onClick={() => void copyText(consoleScript, "console")}
        data-testid="buyme-copy-bridge"
      >
        {copied === "console" ? "קוד Console הועתק" : "העתק קוד ל־Console"}
      </button>
      <Link
        href="/vouchers/import/buyme"
        className="block text-center text-xs font-bold text-forest underline"
      >
        המשך למסך חיבור API
      </Link>
    </div>
  );
}

/** @deprecated Prefer BuyMeConnectCard — kept for existing imports. */
export { BuyMeConnectCard as BuyMeBookmarkCard };
