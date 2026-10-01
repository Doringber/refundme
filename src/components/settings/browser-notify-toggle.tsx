"use client";

import { useState, useSyncExternalStore } from "react";
import {
  BROWSER_NOTIFY_STORAGE_KEY,
  isBrowserNotifyEnabled,
  notificationPermission,
  requestNotificationPermission,
  setBrowserNotifyEnabled,
} from "@/lib/notifications/expiry-alerts";

function subscribeNotifyPref(onStoreChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === BROWSER_NOTIFY_STORAGE_KEY || e.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handler);
  window.addEventListener("zikuy-notify-pref", onStoreChange);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("zikuy-notify-pref", onStoreChange);
  };
}

function emitNotifyPref(): void {
  window.dispatchEvent(new Event("zikuy-notify-pref"));
}

function subscribePermission(onStoreChange: () => void): () => void {
  window.addEventListener("zikuy-notify-perm", onStoreChange);
  return () => window.removeEventListener("zikuy-notify-perm", onStoreChange);
}

function emitPermission(): void {
  window.dispatchEvent(new Event("zikuy-notify-perm"));
}

export function BrowserNotifyToggle({
  reminderDays,
  onMessage,
}: {
  reminderDays: number[];
  onMessage: (msg: string) => void;
}) {
  const enabled = useSyncExternalStore(
    subscribeNotifyPref,
    isBrowserNotifyEnabled,
    () => false,
  );
  const permission = useSyncExternalStore(
    subscribePermission,
    notificationPermission,
    () => "default" as const,
  );
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const perm = await requestNotificationPermission();
      emitPermission();
      if (perm === "unsupported") {
        onMessage("הדפדפן לא תומך בהתראות");
        return;
      }
      if (perm !== "granted") {
        setBrowserNotifyEnabled(false);
        emitNotifyPref();
        onMessage(
          perm === "denied"
            ? "ההרשאה להתראות נחסמה בהגדרות הדפדפן"
            : "לא אושרה הרשאת התראות",
        );
        return;
      }
      setBrowserNotifyEnabled(true);
      emitNotifyPref();
      onMessage(
        `התראות דפדפן הופעלו — נזכיר ב־${reminderDays.join(", ")} ימים לפני פקיעה`,
      );
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    setBrowserNotifyEnabled(false);
    emitNotifyPref();
    onMessage("התראות דפדפן כובו");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-eggplant">
        בנוסף ליומן — אפשר לקבל התראת דפדפן כשזיכוי מתקרב לפקיעה (רק עם תוקף
        מאומת). עובד כשהאפליקציה פתוחה או חוזרת לרקע הקדמי.
      </p>
      <p className="text-xs text-eggplant">
        סטטוס הרשאה:{" "}
        {permission === "granted"
          ? "מאושר"
          : permission === "denied"
            ? "חסום"
            : permission === "unsupported"
              ? "לא נתמך"
              : "טרם התבקש"}
      </p>
      {enabled && permission === "granted" ? (
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm"
          onClick={disable}
        >
          כיבוי התראות דפדפן
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary px-5 py-2.5 text-sm"
          onClick={() => void enable()}
          disabled={
            busy || permission === "unsupported" || permission === "denied"
          }
        >
          הפעלת התראות דפדפן
        </button>
      )}
    </div>
  );
}
