"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/layout/back-link";
import {
  BUYME_CONNECTED_MESSAGE,
  readBuyMeImportHash,
} from "@/lib/buyme-import";

function notifyOpenerAndClose() {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: BUYME_CONNECTED_MESSAGE },
        window.location.origin,
      );
    }
  } catch {
    /* ignore cross-window issues */
  }
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
  }, 120);
}

/**
 * Landing for the existing BuyMe bridge (`#token=`). Not a second connect
 * screen: with no token we go to Settings, which is the only connect UI.
 */
export default function BuyMeImportPage() {
  const router = useRouter();
  const [message, setMessage] = useState("בודקים את החיבור…");

  useEffect(() => {
    const { token } = readBuyMeImportHash(window.location.hash);
    if (!token) {
      router.replace("/settings#buyme");
      return;
    }
    history.replaceState(null, "", window.location.pathname);
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/buyme/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const saved = (await res.json()) as {
        error?: string | null;
        sync?: { status?: string } | null;
      };
      if (cancelled) return;
      if (!res.ok) {
        setMessage("החיבור מ־BuyMe לא נשמר. חזרו להגדרות ונסו שוב.");
        return;
      }
      if (saved.error === "app_login_required") {
        setMessage("התחברו לזיכוי שלי באותו דפדפן, ואז חברו שוב את BuyMe מההגדרות.");
        return;
      }
      if (saved.sync?.status === "login_required") {
        setMessage("BuyMe דורש חיבור מחדש. חזרו להגדרות.");
        return;
      }
      if (window.opener && !window.opener.closed) {
        notifyOpenerAndClose();
        setMessage("החיבור נשמר. אפשר לסגור את החלון.");
        return;
      }
      router.replace("/settings#buyme");
    })().catch(() => {
      if (!cancelled) setMessage("שמירת החיבור נכשלה. חזרו להגדרות ונסו שוב.");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BackLink href="/settings#buyme" label="חזרה להגדרות" />
      <p className="text-sm font-semibold text-eggplant" role="status">
        {message}
      </p>
    </div>
  );
}
