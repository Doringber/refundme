"use client";

import { useState, useSyncExternalStore } from "react";
import { buyMeBookmarkletHref } from "@/lib/buyme-import";

function subscribe() {
  return () => {};
}

/**
 * Creative "button on BuyMe": a bookmark the user taps while on המתנות שלי.
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
      <p className="font-display text-base text-forest">כפתור בצד של BuyMe</p>
      <p className="text-xs font-semibold leading-relaxed text-eggplant">
        אין API ל־BuyMe — אז זה טריק חכם: שומרים סימנייה בדפדפן. כשאתם ב־«המתנות
        שלי» ב־buyme.co.il לוחצים עליה פעם אחת — וכל המתנות עם יתרה קופצות לכאן
        לייבוא, בלי לצלם כרטיס־כרטיס.
      </p>
      <ol className="list-decimal space-y-1 pe-5 text-xs font-semibold text-eggplant">
        <li>לחצו ארוכות / גררו את הכפתור למטה לסרגל הסימניות</li>
        <li>פתחו ב־BuyMe את «המתנות שלי»</li>
        <li>לחצו על הסימנייה «ייבוא לזיכוי שלי»</li>
      </ol>
      <a
        href={href}
        className="btn-primary flex w-full items-center justify-center py-3 text-sm"
        onClick={(e) => {
          // Prevent running the bookmarklet on our own site by accident
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
          : "ייבוא לזיכוי שלי ✦ גררו לסימניות"}
      </a>
      <p className="text-[11px] leading-relaxed text-eggplant">
        באייפון: העתיקו את הקישור והדביקו ככתובת סימנייה (מתחיל ב־javascript:),
        או צלמו־מסך אחד של כל «המתנות שלי» למטה.
      </p>
    </div>
  );
}
