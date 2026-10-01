"use client";

import { useState, useSyncExternalStore } from "react";
import { buyMeBookmarkletHref } from "@/lib/buyme-import";

function subscribe() {
  return () => {};
}

/**
 * "Button on BuyMe": bookmarklet that steals nothing —
 * reads the user's own Ember JWT after they logged in, like maccabi-health
 * session export + buyme-mcp token auth.
 */
export function BuyMeBookmarkCard() {
  const href = useSyncExternalStore(
    subscribe,
    () => buyMeBookmarkletHref(window.location.origin),
    () => "#",
  );
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[rgba(71,181,168,0.35)] bg-[rgba(71,181,168,0.08)] px-4 py-4">
      <p className="font-display text-base text-forest">התחברות ל־BuyMe (API)</p>
      <p className="text-xs font-semibold leading-relaxed text-eggplant">
        כמו לקוח לא־רשמי ל־API סגור: אחרי שאתם מחוברים ב־BuyMe, הסימנייה קוראת
        את ה־JWT שלכם ושולפת את כל הארנק (שם, יתרה, קוד, ברקוד, תוקף) — בלי לצלם
        כרטיסים.
      </p>
      <ol className="list-decimal space-y-1 pe-5 text-xs font-semibold text-eggplant">
        <li>גררו / העתיקו את הכפתור לסימניות</li>
        <li>התחברו ב־buyme.co.il (גוגל) ופתחו «המתנות שלי»</li>
        <li>לחצו על הסימנייה — הייבוא נפתח כאן אוטומטית</li>
      </ol>
      <a
        href={href}
        className="btn-primary flex w-full items-center justify-center py-3 text-sm"
        onClick={(e) => {
          e.preventDefault();
          void copyLink();
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/uri-list", href);
          e.dataTransfer.setData("text/plain", href);
        }}
        data-testid="buyme-bookmarklet"
      >
        {copied
          ? "הקישור הועתק — הדביקו כסימנייה"
          : "חבר BuyMe ✦ גררו לסימניות"}
      </a>
      <p className="text-[11px] leading-relaxed text-eggplant">
        הטוקן נשמר אצלנו בעוגייה מאובטחת (httpOnly) ונשלח רק ל־API של BuyMe בשמכם.
        אפשר לנתק בכל עת.
      </p>
    </div>
  );
}
