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
 * BuyMe import for iOS + Android + desktop web.
 *
 * We cannot scrape buyme.co.il from our origin (browser same-origin), and we
 * cannot run Puppeteer on the user’s phone from a website. What works:
 * - Android: bookmark that runs JS *on* BuyMe and dumps page text to us
 * - iOS: Shortcuts “Run JavaScript on Webpage” (same idea via Share)
 * - All: full-screen photo + OCR, paste, or demo fixture
 */
export function BuyMeConnectCard({
  onPickScreenshot,
  onParsedText,
  screenshotBusy = false,
}: BuyMeConnectCardProps) {
  const platform = usePlatform();
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
      if (document.visibilityState !== "visible" || !awaitingReturn) return;
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
    if (!win) window.location.assign(BUYME_SITE_URL);
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

  function runDemo() {
    const gifts = demoBuyMeGiftsFromFixture();
    if (!gifts.length) {
      setPasteError("דמו לא נטען");
      return;
    }
    onParsedText?.(gifts);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">ייבוא חכם מ־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          שואבים את «המתנות שלי» במכה — באנדרואיד, באייפון ובדפדפן. בלי להיכנס
          ידנית לכל כרטיס.
        </p>
      </div>

      <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
        <p className="text-xs font-bold text-forest">
          1. כפתור שאיבה ב־BuyMe (פעם אחת)
        </p>

        {platform === "android" && (
          <>
            <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
              באנדרואיד (Chrome): שומרים סימנייה שמריצה קוד <span className="text-forest">בתוך</span>{" "}
              עמוד המתנות — קוראת את הטקסט (כמו jQuery על הדף) ומחזירה אותנו עם
              כל הרשימה. האתר שלנו לא יכול לקרוא את BuyMe מרחוק (אבטחת דפדפן).
            </p>
            <button
              type="button"
              className="btn-secondary w-full py-2.5 text-xs"
              onClick={() => void copyText(pageBookmark, "bookmark")}
              data-testid="buyme-copy-page-bridge"
            >
              {copied === "bookmark"
                ? "הועתק — הדביקו בכתובת הסימנייה"
                : copied === "fail"
                  ? "ההעתקה נכשלה — נסו שוב"
                  : "העתק סימניית «שאיבת מתנות»"}
            </button>
            <ol className="list-decimal space-y-1 pe-5 text-[10px] font-semibold leading-relaxed text-eggplant">
              <li>Chrome → ☆ / סימניות → הוספת סימנייה</li>
              <li>שם: «שאיבת מתנות» · בכתובת הדביקו את מה שהועתק</li>
              <li>ב־BuyMe «המתנות שלי» לחצו על הסימנייה — הרשימה קופצת לכאן</li>
            </ol>
            <a
              href={pageBookmark}
              className="block text-center text-[10px] font-bold text-forest underline"
              onClick={(e) => {
                // Prevent navigating away if JS bookmarks are blocked mid-tap.
                e.preventDefault();
                void copyText(pageBookmark, "bookmark");
              }}
              data-testid="buyme-page-text-bookmark"
            >
              לחצו להעתקה שוב
            </a>
          </>
        )}

        {platform === "ios" && (
          <>
            <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
              באייפון: קיצור «הפעל JavaScript בדף» = הכפתור על עמוד המתנות (דרך
              שיתוף). אותו רעיון כמו באנדרואיד — הקוד רץ בתוך BuyMe.
            </p>
            <button
              type="button"
              className="btn-secondary w-full py-2.5 text-xs"
              onClick={() => void copyText(pageScript, "shortcut")}
              data-testid="buyme-copy-page-bridge"
            >
              {copied === "shortcut"
                ? "הקוד הועתק — הדביקו בקיצור"
                : "העתק קוד לקיצור «שאיבת מתנות»"}
            </button>
            <ol className="list-decimal space-y-1 pe-5 text-[10px] font-semibold leading-relaxed text-eggplant">
              <li>«קיצורים» → קיצור חדש → Safari → הפעל JavaScript בדף</li>
              <li>הדביקו · שמרו בשם «שאיבת מתנות לזיכוי»</li>
              <li>ב־BuyMe: שתף → הקיצור</li>
            </ol>
          </>
        )}

        {platform === "desktop" && (
          <>
            <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
              גררו סימנייה לשורת הסימניות, או העתיקו. ב־BuyMe לוחצים עליה —
              שואבת את כל טקסט הרשימה (לא צריך API).
            </p>
            <a
              href={pageBookmark}
              className="btn-secondary flex w-full items-center justify-center py-2.5 text-xs"
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
                ? "הועתק / שמור כסימנייה «שאיבת מתנות»"
                : "גררו לסימניות · או העתיקו"}
            </a>
          </>
        )}
      </div>

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
          {platform === "android"
            ? "התחברו → המתנות שלי → לחצו על הסימנייה «שאיבת מתנות»."
            : platform === "ios"
              ? "התחברו → המתנות שלי → שתף → קיצור השאיבה."
              : "התחברו → המתנות שלי → לחצו על סימניית השאיבה."}{" "}
          בלי זה — חזרו לכאן וצלמו את כל המסך.
        </p>
      </div>

      {showCaptureNow && onPickScreenshot && (
        <div
          className="space-y-2 rounded-xl border border-[rgba(71,181,168,0.5)] bg-[rgba(71,181,168,0.18)] px-3 py-3"
          role="status"
        >
          <p className="text-xs font-bold text-forest">חזרתם מ־BuyMe?</p>
          <p className="text-[11px] font-semibold text-eggplant">
            צלמו עכשיו את כל מסך «המתנות שלי» — נשאב טקסט מהתמונה במכה.
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
          <span className="text-xs opacity-90">גיבוי · OCR</span>
        </button>
      )}

      {onParsedText && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-secondary w-full py-2.5 text-xs"
            onClick={runDemo}
            data-testid="buyme-demo-import"
          >
            הדגמה — ייבוא רשימת דוגמה (בלי BuyMe)
          </button>
          <p className="text-[10px] leading-relaxed text-eggplant">
            למה לא אוטומציה מלאה מהאתר? דפדפן לא נותן לנו להריץ סקריפט על
            buyme.co.il או לקרוא משם jQuery/DOM. רק קוד שרץ <span className="font-bold">בתוך</span>{" "}
            BuyMe (סימנייה/קיצור) או צילום. אפליקציית Android עם WebView תוכל
            להזריק כפתור אוטומטית בעתיד.
          </p>
        </div>
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

      {platform === "desktop" && (
        <details className="rounded-xl bg-white/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-bold text-forest">
            חיבור API מלא (קודים/ברקודים)
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
      <p>JWT → עוגייה → /siteapi</p>
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
