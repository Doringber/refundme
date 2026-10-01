"use client";

import { useState } from "react";
import {
  BUYME_SITE_URL,
  demoBuyMeGiftsFromFixture,
} from "@/lib/buyme-import";
import type { BuyMeGiftCandidate } from "@/lib/extract-buyme";

export type BuyMeConnectCardProps = {
  onPickScreenshot?: () => void;
  onParsedText?: (gifts: BuyMeGiftCandidate[]) => void;
  screenshotBusy?: boolean;
};

/**
 * One button that works in Chrome + Safari (iPhone/Android/desktop):
 * pick a full screenshot of BuyMe «המתנות שלי» → OCR → import.
 */
export function BuyMeConnectCard({
  onPickScreenshot,
  onParsedText,
  screenshotBusy = false,
}: BuyMeConnectCardProps) {
  const [hint, setHint] = useState(false);

  function openBuyMe() {
    const win = window.open(BUYME_SITE_URL, "_blank");
    if (!win) window.location.assign(BUYME_SITE_URL);
    setHint(true);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">ייבוא מ־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          כפתור אחד — עובד ב־Chrome ובאייפון. צלמו את «המתנות שלי» ונשאב את
          כל המתנות עם יתרה.
        </p>
      </div>

      <button
        type="button"
        className="btn-primary flex w-full flex-col items-center gap-1 py-4 text-base"
        disabled={screenshotBusy || !onPickScreenshot}
        onClick={() => onPickScreenshot?.()}
        data-testid="buyme-import-button"
      >
        <span className="font-extrabold">
          {screenshotBusy ? "שואב מתנות…" : "ייבוא מ־BuyMe"}
        </span>
        <span className="text-xs font-semibold opacity-90">
          בחרו צילום מסך של «המתנות שלי»
        </span>
      </button>

      <button
        type="button"
        className="w-full text-center text-xs font-bold text-forest underline"
        onClick={openBuyMe}
        data-testid="buyme-open-site"
      >
        {hint
          ? "BuyMe נפתח — צלמו את הרשימה וחזרו לכפתור למעלה"
          : "אין צילום עדיין? פתחו את BuyMe"}
      </button>

      {onParsedText && (
        <button
          type="button"
          className="w-full text-center text-[11px] font-semibold text-eggplant underline"
          onClick={() => onParsedText(demoBuyMeGiftsFromFixture())}
          data-testid="buyme-demo-import"
        >
          הדגמה בלי צילום
        </button>
      )}
    </div>
  );
}

export { BuyMeConnectCard as BuyMeBookmarkCard };
