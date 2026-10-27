"use client";

import { useState } from "react";
import { DEMO_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

function clearDemoCookie() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

type Props = {
  label?: string;
  next?: string;
  className?: string;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({
  label = "המשך עם Google",
  next = "/dashboard",
  className = "btn-primary w-full py-3.5 text-base",
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      clearDemoCookie();
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "online",
            prompt: "select_account",
          },
        },
      });
      if (error) {
        onError?.(error.message);
        setBusy(false);
      }
      // On success the browser navigates to Google; keep busy until then.
    } catch {
      onError?.("התחברות עם Google נכשלה");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => void handleClick()}
      aria-label={label}
    >
      <span className="inline-flex items-center justify-center gap-2">
        <GoogleGlyph />
        {busy ? "מעבירים ל־Google…" : label}
      </span>
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.5 26.8 36.5 24 36.5c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 36.3 44 31.5 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
