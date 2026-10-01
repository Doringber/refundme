"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  captureBuyMeFromExtension,
  detectBuyMeExtension,
  type BuyMeExtensionCapture,
} from "@/lib/buyme/extension-client";

export type BuyMeConnectCardProps = {
  onSynced?: (report: { upserted: number; fetched: number }) => void;
};

type Phase = "checking" | "missing" | "ready" | "working" | "done" | "failed";

function subscribePhone() {
  return () => {};
}

function isPhoneBrowser(): boolean {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|CriOS|FxiOS/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function resultMessage(result: BuyMeExtensionCapture): string {
  if (result.sync?.status === "synced") {
    const fetched = result.sync.fetched ?? 0;
    if (fetched <= 0) {
      return "החיבור הצליח, אבל BuyMe החזיר ארנק ריק. לא יובאו מתנות.";
    }
    return `נמשכו ${fetched} מתנות מ־BuyMe ועודכנו ${result.sync.upserted}.`;
  }
  if (result.error === "app_login_required") {
    return "התחברו לזיכוי שלי באותו דפדפן, ואז לחצו שוב. בלי חשבון אין לאן לשמור.";
  }
  if (result.sync?.status === "login_required" || result.error === "login_required") {
    return "לא נמצא חיבור פעיל ב־BuyMe. התחברו בחלון שנפתח — הסנכרון ממשיך לבד אחרי ההתחברות.";
  }
  if (result.error === "timeout") {
    return "ההמתנה ל־BuyMe הסתיימה בלי חיבור. התחברו שם ולחצו שוב.";
  }
  if (result.sync?.error === "wallet_fetch_failed" || result.error === "sync_failed") {
    return "החיבור נשמר, אבל שאיבת הארנק מ־BuyMe נכשלה. לא יובאו מתנות.";
  }
  return "הסנכרון לא הושלם. לא יובאו מתנות.";
}

export function BuyMeConnectCard({ onSynced }: BuyMeConnectCardProps) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const phone = useSyncExternalStore(subscribePhone, isPhoneBrowser, () => false);

  useEffect(() => {
    let cancelled = false;
    void detectBuyMeExtension().then((installed) => {
      if (!cancelled) setPhase(installed ? "ready" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function syncNow() {
    setPhase("working");
    setMessage(
      "נפתח BuyMe. אם אתם כבר מחוברים שם, המתנות נכנסות לבד. אם לא — התחברו בחלון שנפתח.",
    );
    const result = await captureBuyMeFromExtension({ interactive: true });
    const fetched = result.sync?.fetched ?? 0;
    if (result.sync?.status === "synced" && fetched > 0) {
      setPhase("done");
      setMessage(resultMessage(result));
      onSynced?.({ upserted: result.sync.upserted, fetched });
      return;
    }
    setPhase("failed");
    setMessage(resultMessage(result));
  }

  async function copyExtensionsPage() {
    try {
      await navigator.clipboard.writeText("chrome://extensions");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">סנכרון אוטומטי מ־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          אחרי התחברות ל־BuyMe בכרום, התוסף קורא את החיבור שכבר פתוח אצלכם
          ומושך את הארנק. פתיחת האתר לבד לא מחברת.
        </p>
      </div>

      {phase === "checking" && (
        <p className="text-xs font-semibold text-eggplant">בודקים אם חיבור הכרום מותקן…</p>
      )}

      {phase !== "checking" && phase !== "missing" && (
        <button
          type="button"
          className="btn-primary flex w-full items-center justify-center py-3.5 text-sm"
          onClick={() => void syncNow()}
          disabled={phase === "working"}
          data-testid="buyme-auto-sync"
        >
          {phase === "working" ? "מושכים את הארנק מ־BuyMe…" : "סנכרון אוטומטי מ־BuyMe"}
        </button>
      )}

      {phase === "missing" && phone && (
        <p className="text-xs font-semibold leading-relaxed text-eggplant" role="status">
          בדפדפן של הטלפון אי אפשר לקרוא את ההתחברות של BuyMe. הסנכרון האוטומטי
          רץ בכרום במחשב, אחרי התקנה אחת של חיבור הכרום.
        </p>
      )}

      {phase === "missing" && !phone && (
        <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
          <p className="text-xs font-bold text-forest">התקנה אחת בכרום</p>
          <ol className="list-decimal space-y-1 pe-5 text-[11px] font-semibold leading-relaxed text-eggplant">
            <li>הורידו את חיבור הכרום וחלצו את התיקייה</li>
            <li>פתחו chrome://extensions והפעילו מצב מפתח</li>
            <li>טעינה ללא אריזה — בחרו את התיקייה שחולצה</li>
            <li>רעננו את הדף הזה ולחצו «סנכרון אוטומטי»</li>
          </ol>
          <a
            href="/api/buyme/extension"
            className="btn-primary flex w-full items-center justify-center py-3 text-sm"
            data-testid="buyme-download-extension"
          >
            הורדת חיבור הכרום
          </a>
          <button
            type="button"
            className="btn-secondary w-full py-2.5 text-xs"
            onClick={() => void copyExtensionsPage()}
            data-testid="buyme-copy-extensions"
          >
            {copied ? "הועתק — הדביקו בשורת הכתובת" : "העתקת chrome://extensions"}
          </button>
          <button
            type="button"
            className="w-full py-1 text-xs font-bold text-forest underline"
            onClick={() => window.location.reload()}
          >
            כבר התקנתי — רענון ובדיקה
          </button>
        </div>
      )}

      {message && (
        <p
          className="rounded-xl bg-white/10 px-3 py-3 text-xs font-semibold leading-relaxed text-eggplant"
          role="status"
          data-testid="buyme-sync-status"
        >
          {message}
        </p>
      )}
    </div>
  );
}

/** @deprecated Prefer BuyMeConnectCard — kept for existing imports. */
export { BuyMeConnectCard as BuyMeBookmarkCard };
