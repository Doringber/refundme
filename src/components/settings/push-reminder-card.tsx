"use client";

import { useState } from "react";

import { APP_NAME } from "@/lib/constants";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function iosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function installedToHomeScreen(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  );
}

export function PushReminderCard({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

  async function enable() {
    setBusy(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        onMessage("הדפדפן הזה לא יודע התראות דחיפה. נשאר מייל, אם הוא פעיל.");
        return;
      }
      if (iosDevice() && !installedToHomeScreen()) {
        onMessage(`באייפון צריך קודם להוסיף את ${APP_NAME} למסך הבית, ואז לפתוח מהאייקון.`);
        return;
      }
      if (!publicKey) {
        onMessage("התראות דחיפה עדיין לא הוגדרו בשרת (מפתח VAPID).");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        onMessage("בלי אישור, אין התראת דחיפה. אפשר להשאיר את מייל הגיבוי.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        onMessage(
          json.error === "migration_required"
            ? "ההרשמה מחכה למיגרציה ב־Supabase. היא עדיין לא הופעלה."
            : "שמירת ההתראה נכשלה.",
        );
        return;
      }
      onMessage("התראות דחיפה פעילות. נדחוף לפני הפקיעה גם כשהאפליקציה סגורה.");
    } catch {
      onMessage("לא הצלחנו להפעיל התראות דחיפה במכשיר הזה.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      onMessage("התראות הדחיפה כובו במכשיר הזה.");
    } catch {
      onMessage("כיבוי ההתראות נכשל.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white/60 p-4">
      <p className="text-sm font-extrabold text-forest">התראה גם כשהשקית סגורה</p>
      <p className="text-sm leading-relaxed text-eggplant">
        באייפון זה עובד רק אחרי שמוסיפים את {APP_NAME} למסך הבית (שתף ← הוספה
        למסך הבית) ופותחים מהאייקון. צריך iOS 16.4 ומעלה. מספארי הרגיל אי אפשר
        לקבל Web Push. אם אין דחיפה, נשלח מייל במקום — כשהגיבוי פעיל ויש שירות מייל.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary min-h-11 px-4 py-2 text-sm"
          disabled={busy}
          onClick={() => void enable()}
        >
          {busy ? "רגע…" : "הפעלת התראות"}
        </button>
        <details>
          <summary className="min-h-11 cursor-pointer text-sm font-bold text-eggplant">
            כיבוי במכשיר הזה
          </summary>
          <button
            type="button"
            className="btn-secondary mt-2 min-h-11 px-4 py-2 text-sm"
            disabled={busy}
            onClick={() => void disable()}
          >
            כיבוי התראות הדחיפה
          </button>
        </details>
      </div>
    </div>
  );
}
