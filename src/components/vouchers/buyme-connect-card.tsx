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
 * Connect flow that matches the mental model:
 * open a temporary BuyMe window → user signs in → one tap sends the
 * session back → we store the token and continue with the API.
 *
 * Browsers block reading BuyMe storage from our origin, so the one-tap
 * “כפתור חיבור” (saved once to the bookmarks bar) must run on BuyMe’s tab.
 */
export function BuyMeConnectCard({ onPopupOpened }: BuyMeConnectCardProps) {
  const href = useSyncExternalStore(
    subscribe,
    () => buyMeBookmarkletHref(window.location.origin),
    () => "#",
  );
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);

  function openBuyMeWindow() {
    const popup = window.open(
      BUYME_SITE_URL,
      "buyme_connect",
      "popup=yes,width=490,height=780",
    );
    if (!popup) {
      // Popup blocked — fall back to same-tab navigation hint
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

  async function copyConnectButton() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <div>
        <p className="font-display text-base text-forest">חיבור ל־BuyMe</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-eggplant">
          נפתח חלון זמני של BuyMe. אחרי שתתחברו שם, לחיצה אחת מחזירה אותנו לכאן
          עם הארנק — והחלון נסגר.
        </p>
      </div>

      <button
        type="button"
        className="btn-primary flex w-full items-center justify-center py-3.5 text-sm"
        onClick={openBuyMeWindow}
        data-testid="buyme-open-popup"
      >
        {opened ? "החלון פתוח — התחברו ב־BuyMe" : "פתח חלון חיבור ל־BuyMe"}
      </button>

      <div className="space-y-2 rounded-xl bg-white/10 px-3 py-3">
        <p className="text-xs font-bold text-forest">
          פעם אחת בלבד: שמרו את כפתור החיבור
        </p>
        <p className="text-[11px] font-semibold leading-relaxed text-eggplant">
          הדפדפן לא מרשה לאתר שלנו לקרוא את BuyMe ישירות (אבטחה). לכן שומרים
          כפתור קטן בשורת הסימניות — ואחרי ההתחברות בחלון, לוחצים עליו פעם אחת.
          הוא שולח אלינו את החיבור וסוגר את המעגל.
        </p>
        <a
          href={href}
          className="btn-secondary flex w-full items-center justify-center py-2.5 text-xs"
          onClick={(e) => {
            e.preventDefault();
            void copyConnectButton();
          }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/uri-list", href);
            e.dataTransfer.setData("text/plain", href);
          }}
          data-testid="buyme-bookmarklet"
        >
          {copied
            ? "הועתק — הדביקו כסימנייה / גררו לשורת הסימניות"
            : "גררו לשורת הסימניות · או העתיקו"}
        </a>
      </div>

      <ol className="list-decimal space-y-1 pe-5 text-xs font-semibold text-eggplant">
        <li>לחצו «פתח חלון חיבור» והתחברו ב־BuyMe (גוגל)</li>
        <li>בחלון של BuyMe לחצו על כפתור החיבור ששמרתם</li>
        <li>החלון חוזר אלינו, נשמר החיבור, וממשיכים לייבוא</li>
      </ol>
    </div>
  );
}

/** @deprecated Prefer BuyMeConnectCard — kept for existing imports. */
export { BuyMeConnectCard as BuyMeBookmarkCard };
