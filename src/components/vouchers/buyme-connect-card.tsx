"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BUYME_SITE_URL,
  buyMeBookmarkletHref,
  buyMeBridgeConsoleScript,
  buyMePageTextBookmarkletHref,
  buyMePageTextBridgeScript,
  demoBuyMeGiftsFromFixture,
  markAwaitingBuyMeCapture,
  parseBuyMePageText,
} from "@/lib/buyme-import";
import {
  detectBuyMeClientPlatform,
  type BuyMeClientPlatform,
} from "@/lib/buyme-platform";
import type { BuyMeGiftCandidate } from "@/lib/extract-buyme";

function subscribe() {
  return () => {};
}

function usePlatform(): BuyMeClientPlatform {
  return useSyncExternalStore(
    subscribe,
    () => detectBuyMeClientPlatform(),
    () => "desktop" as const,
  );
}

export type BuyMeConnectCardProps = {
  onPickScreenshot?: () => void;
  onParsedText?: (gifts: BuyMeGiftCandidate[]) => void;
  screenshotBusy?: boolean;
};

/**
 * Normal iPhone path = login on BuyMe → come back → one tap runs a
 * “screen crawler” (full-page photo + OCR/text extract). Safari will not
 * let our site inject a DOM crawler into buyme.co.il after login.
 */
export function BuyMeConnectCard({
  onPickScreenshot,
  onParsedText,
  screenshotBusy = false,
}: BuyMeConnectCardProps) {
  const platform = usePlatform();
  const isIos = platform === "ios";
  const isAndroid = platform === "android";
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
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [phase, setPhase] = useState<"start" | "awaiting" | "crawl">("start");

  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "visible") return;
      if (phase !== "awaiting") return;
      setPhase("crawl");
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [phase]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
      window.setTimeout(() => setCopied("idle"), 2800);
    } catch {
      setCopied("fail");
    }
  }

  function openBuyMeLogin() {
    markAwaitingBuyMeCapture();
    setPhase("awaiting");
    const win = window.open(BUYME_SITE_URL, "_blank");
    if (!win) window.location.assign(BUYME_SITE_URL);
  }

  function startScreenCrawl() {
    // Must stay in the tap gesture so iOS allows the file picker.
    onPickScreenshot?.();
  }

  function submitPaste() {
    setPasteError(null);
    const gifts = parseBuyMePageText(paste);
    if (!gifts.length) {
      setPasteError("לא מצאנו מתנות עם יתרה בטקסט שהודבק.");
      return;
    }
    onParsedText?.(gifts);
  }

  function runDemo() {
    onParsedText?.(demoBuyMeGiftsFromFixture());
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">שאיבת מתנות מ־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          {isIos
            ? "באייפון: מתחברים ב־BuyMe, חוזרים לכאן, ולוחצים שאיבה — הקרולר רץ על צילום המסך המלא (Safari לא נותן לנו להזריק קוד לתוך BuyMe)."
            : "מתחברים ב־BuyMe → שואבים את רשימת «המתנות שלי» במכה."}
        </p>
      </div>

      {/* —— Primary normal flow —— */}
      <ol className="space-y-3">
        <li className="space-y-2">
          <p className="text-xs font-bold text-forest">1. התחברות ב־BuyMe</p>
          <button
            type="button"
            className="btn-primary w-full py-3.5 text-sm"
            onClick={openBuyMeLogin}
            data-testid="buyme-open-site"
          >
            {phase === "awaiting"
              ? "BuyMe פתוח — התחברו ופתחו «המתנות שלי»"
              : "פתח את BuyMe והתחבר"}
          </button>
          {phase === "awaiting" && (
            <p className="text-[11px] font-semibold text-eggplant" role="status">
              אחרי לוגין ופתיחת «המתנות שלי» — חזרו לכאן (או ללשונית של זיכוי
              שלי).
            </p>
          )}
        </li>

        <li className="space-y-2">
          <p className="text-xs font-bold text-forest">
            2. שאיבה (קרולר על המסך)
          </p>
          {phase === "crawl" ? (
            <div
              className="space-y-2 rounded-xl border border-[rgba(71,181,168,0.55)] bg-[rgba(71,181,168,0.2)] px-3 py-3"
              role="status"
            >
              <p className="text-xs font-bold text-forest">מוכנים לשאיבה</p>
              <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
                בחרו צילום מסך של כל «המתנות שלי» (או צלמו עכשיו). נחלץ ממנו את
                כל המתנות עם יתרה — כמו קרולר על הדף אחרי לוגין.
              </p>
              <button
                type="button"
                className="btn-primary w-full py-3.5 text-sm"
                disabled={screenshotBusy || !onPickScreenshot}
                onClick={startScreenCrawl}
                data-testid="buyme-capture-now"
              >
                {screenshotBusy ? "שואב מהמסך…" : "שאב עכשיו מהמסך"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary flex w-full flex-col items-center gap-1 py-3 text-sm"
              disabled={screenshotBusy || !onPickScreenshot}
              onClick={startScreenCrawl}
              data-testid="buyme-import-button"
            >
              <span className="font-extrabold">
                {screenshotBusy ? "שואב…" : "שאב מצילום «המתנות שלי»"}
              </span>
              <span className="text-xs opacity-90">
                אפשר גם בלי שלב 1 אם כבר יש צילום
              </span>
            </button>
          )}
        </li>
      </ol>

      {onParsedText && (
        <button
          type="button"
          className="w-full text-center text-xs font-bold text-forest underline"
          onClick={runDemo}
          data-testid="buyme-demo-import"
        >
          הדגמה עם רשימת דוגמה
        </button>
      )}

      {/* —— Advanced: in-page script (true DOM crawl on BuyMe) —— */}
      <details className="rounded-xl bg-white/10 px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold text-forest">
          מתקדם: קרולר בתוך הדף של BuyMe
        </summary>
        <div className="mt-2 space-y-2 text-[11px] font-semibold leading-relaxed text-eggplant">
          <p>
            זה הקוד שרץ <span className="text-forest">אחרי לוגין בתוך BuyMe</span>{" "}
            וקורא את ה־DOM (לא מרחוק). באייפון זה דרך קיצור; באנדרואיד דרך
            סימנייה.
          </p>
          {isIos && (
            <>
              <button
                type="button"
                className="btn-secondary w-full py-2 text-xs"
                onClick={() => void copy(pageScript)}
                data-testid="buyme-copy-page-bridge"
              >
                {copied === "ok"
                  ? "הועתק"
                  : copied === "fail"
                    ? "נכשל — נסו שוב"
                    : "העתק קוד לקיצור iOS"}
              </button>
              <ol className="list-decimal space-y-1 pe-5 text-[10px]">
                <li>קיצורים → הפעל JavaScript בדף אינטרנט</li>
                <li>הדביקו · שמרו «שאיבת מתנות»</li>
                <li>ב־BuyMe אחרי לוגין: שתף → הקיצור</li>
              </ol>
            </>
          )}
          {isAndroid && (
            <>
              <button
                type="button"
                className="btn-secondary w-full py-2 text-xs"
                onClick={() => void copy(pageBookmark)}
                data-testid="buyme-copy-page-bridge"
              >
                {copied === "ok" ? "הועתק לסימנייה" : "העתק סימניית קרולר (Android)"}
              </button>
              <ol className="list-decimal space-y-1 pe-5 text-[10px]">
                <li>Chrome → סימנייה חדשה · הדביקו בכתובת</li>
                <li>ב־BuyMe אחרי לוגין לחצו על הסימנייה</li>
              </ol>
            </>
          )}
          {platform === "desktop" && (
            <a
              href={pageBookmark}
              className="btn-secondary flex w-full items-center justify-center py-2 text-xs"
              onClick={(e) => {
                e.preventDefault();
                void copy(pageBookmark);
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/uri-list", pageBookmark);
                e.dataTransfer.setData("text/plain", pageBookmark);
              }}
              data-testid="buyme-page-text-bookmark"
            >
              גררו סימניית קרולר / העתיקו
            </a>
          )}
        </div>
      </details>

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

      {platform === "desktop" && (
        <details className="rounded-xl bg-white/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-bold text-forest">
            API מלא (קודים/ברקודים)
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
      <p>אחרי לוגין: JWT מהדף → השרת קורא ל־/siteapi (קרולר אמיתי על ה־API).</p>
      <button
        type="button"
        className="btn-secondary w-full py-2 text-xs"
        onClick={() => void copy(consoleScript)}
        data-testid="buyme-copy-bridge"
      >
        {copied === "ok" ? "הועתק" : "העתק קוד Console"}
      </button>
      <button
        type="button"
        className="btn-secondary w-full py-2 text-xs"
        onClick={() => void copy(bookmarkHref)}
      >
        העתק סימניית JWT
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
