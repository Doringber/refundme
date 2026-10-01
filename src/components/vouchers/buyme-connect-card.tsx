"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BUYME_SITE_URL,
  buyMeBookmarkletHref,
  buyMeBridgeConsoleScript,
  buyMePageTextBookmarkletHref,
  buyMePageTextBridgeScript,
  markAwaitingBuyMeCapture,
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
  onPickScreenshot?: () => void;
  onParsedText?: (gifts: BuyMeGiftCandidate[]) => void;
  screenshotBusy?: boolean;
};

/**
 * Smart phone import for BuyMe «המתנות שלי»:
 * 1) One-time “button” via iOS Shortcut / Android bookmark (pulls all page text)
 * 2) Open BuyMe → on return, big capture CTA for a full-screen shot + OCR
 * 3) Paste fallback · desktop API stays experimental
 */
export function BuyMeConnectCard({
  onPickScreenshot,
  onParsedText,
  screenshotBusy = false,
}: BuyMeConnectCardProps) {
  const isPhone = useIsCoarsePointer();
  const pageScript = useSyncExternalStore(
    subscribe,
    () => buyMePageTextBridgeScript(window.location.origin),
    () => "",
  );
  const pageBookmark = useSyncExternalStore(
    subscribe,
    () => buyMePageTextBookmarkletHref(window.location.origin),
    () => "#",
  );
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "shortcut" | "bookmark" | "fail">(
    "idle",
  );
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [showCaptureNow, setShowCaptureNow] = useState(false);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "visible") return;
      if (!awaitingReturn) return;
      setShowCaptureNow(true);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [awaitingReturn]);

  async function copyText(text: string, kind: "shortcut" | "bookmark") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied("idle"), 2800);
    } catch {
      setCopied("fail");
    }
  }

  function openBuyMe() {
    markAwaitingBuyMeCapture();
    setAwaitingReturn(true);
    setShowCaptureNow(false);
    const win = window.open(BUYME_SITE_URL, "_blank");
    if (!win) {
      window.location.assign(BUYME_SITE_URL);
    }
  }

  function submitPaste() {
    setPasteError(null);
    const gifts = parseBuyMePageText(paste);
    if (!gifts.length) {
      setPasteError(
        "לא מצאנו מתנות עם יתרה בטקסט. העתיקו מ־BuyMe את רשימת «המתנות שלי».",
      );
      return;
    }
    onParsedText?.(gifts);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">ייבוא חכם מ־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          כפתור ב־«המתנות שלי» ששואב את כל הרשימה במכה — או צילום מסך מלא כשחוזרים.
        </p>
      </div>

      {/* One-time “button on BuyMe” via Shortcut / bookmark */}
      <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
        <p className="text-xs font-bold text-forest">
          1. כפתור ב־BuyMe (פעם אחת)
        </p>
        <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
          {isPhone
            ? "אייפון: קיצור ב־«קיצורים» שרץ מתוך שיתוף ב־Safari על עמוד המתנות — שולף את כל הטקסט בלי לצלם כרטיס־כרטיס."
            : "שמרו סימנייה / קיצור שרץ על עמוד «המתנות שלי» ושולף את כל הרשימה."}
        </p>
        <button
          type="button"
          className="btn-secondary w-full py-2.5 text-xs"
          onClick={() => void copyText(pageScript, "shortcut")}
          data-testid="buyme-copy-page-bridge"
        >
          {copied === "shortcut"
            ? "הקוד הועתק — הדביקו בקיצור «הפעל JavaScript בדף»"
            : copied === "fail"
              ? "ההעתקה נכשלה — נסו שוב"
              : "העתק קוד לכפתור «שאיבת מתנות»"}
        </button>
        {isPhone && (
          <ol className="list-decimal space-y-1 pe-5 text-[10px] font-semibold leading-relaxed text-eggplant">
            <li>אפליקציית «קיצורים» → קיצור חדש</li>
            <li>
              פעולה: Safari → <span className="text-forest">הפעל JavaScript בדף אינטרנט</span>
            </li>
            <li>הדביקו את הקוד · שמרו בשם «שאיבת מתנות לזיכוי»</li>
            <li>
              ב־BuyMe «המתנות שלי»: שתף → הקיצור — הרשימה מגיעה לכאן אוטומטית
            </li>
          </ol>
        )}
        {!isPhone && (
          <a
            href={pageBookmark}
            className="btn-secondary flex w-full items-center justify-center py-2 text-xs"
            onClick={(e) => {
              e.preventDefault();
              void copyText(pageBookmark, "bookmark");
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/uri-list", pageBookmark);
              e.dataTransfer.setData("text/plain", pageBookmark);
            }}
            data-testid="buyme-page-text-bookmark"
          >
            {copied === "bookmark"
              ? "הועתק — שמרו כסימנייה «שאיבת מתנות»"
              : "או גררו/העתיקו כסימנייה לדפדפן"}
          </a>
        )}
      </div>

      {/* Open BuyMe + capture on return */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-forest">2. פתחו את המתנות ושלפו</p>
        <button
          type="button"
          className="btn-primary w-full py-3.5 text-sm"
          onClick={openBuyMe}
          data-testid="buyme-open-site"
        >
          פתח «המתנות שלי» ב־BuyMe
        </button>
        <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
          שם: התחברו → פתחו את הרשימה → הפעילו את הקיצור/הסימנייה «שאיבת מתנות».
          בלי קיצור? חזרו לכאן וצלמו את כל המסך.
        </p>
      </div>

      {showCaptureNow && onPickScreenshot && (
        <div
          className="space-y-2 rounded-xl border border-[rgba(71,181,168,0.5)] bg-[rgba(71,181,168,0.18)] px-3 py-3"
          role="status"
        >
          <p className="text-xs font-bold text-forest">חזרתם מ־BuyMe?</p>
          <p className="text-[11px] font-semibold text-eggplant">
            צלמו עכשיו את כל מסך «המתנות שלי» — נשאב את הטקסט מהתמונה במכה אחת.
          </p>
          <button
            type="button"
            className="btn-primary w-full py-3 text-sm"
            disabled={screenshotBusy}
            onClick={onPickScreenshot}
            data-testid="buyme-capture-now"
          >
            צלם את כל המסך עכשיו
          </button>
        </div>
      )}

      {onPickScreenshot && !showCaptureNow && (
        <button
          type="button"
          className="btn-secondary flex w-full flex-col items-center gap-1 py-3 text-sm"
          disabled={screenshotBusy}
          onClick={onPickScreenshot}
          data-testid="buyme-import-button"
        >
          <span className="font-extrabold">צילום מסך של כל הרשימה</span>
          <span className="text-xs opacity-90">גיבוי בלי קיצור · OCR</span>
        </button>
      )}

      {onParsedText && (
        <details className="rounded-xl bg-white/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-bold text-forest">
            הדבקת טקסט ידנית
          </summary>
          <div className="mt-2 space-y-2">
            <textarea
              className="min-h-24 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
              placeholder={"BUYME ALL\nיתרה: ₪881"}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              data-testid="buyme-paste-text"
            />
            <button
              type="button"
              className="btn-secondary w-full py-2 text-xs"
              disabled={!paste.trim()}
              onClick={submitPaste}
            >
              ייבוא מהטקסט
            </button>
            {pasteError && (
              <p className="text-xs text-[rgb(180,60,40)]" role="alert">
                {pasteError}
              </p>
            )}
          </div>
        </details>
      )}

      {!isPhone && (
        <details className="rounded-xl bg-white/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-bold text-forest">
            במחשב: חיבור API מלא (קודים/ברקודים)
          </summary>
          <DesktopApiConnect />
        </details>
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
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
      window.setTimeout(() => setCopied("idle"), 2200);
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="mt-2 space-y-2 text-[11px] font-semibold text-eggplant">
      <p>JWT → עוגייה → /siteapi — לקודים וברקודים אמיתיים.</p>
      <button
        type="button"
        className="btn-secondary w-full py-2 text-xs"
        onClick={() => void copy(bookmarkHref)}
      >
        העתק סימניית JWT
      </button>
      <button
        type="button"
        className="btn-secondary w-full py-2 text-xs"
        onClick={() => void copy(consoleScript)}
        data-testid="buyme-copy-bridge"
      >
        {copied === "ok" ? "הועתק" : "העתק קוד Console"}
      </button>
      <Link
        href="/vouchers/import/buyme"
        className="block text-center text-xs font-bold text-forest underline"
      >
        מסך חיבור API
      </Link>
    </div>
  );
}

export { BuyMeConnectCard as BuyMeBookmarkCard };
