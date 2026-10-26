"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DemoEntryButton } from "@/components/auth/demo-entry-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LegalLinks } from "@/components/legal-links";
import { oauthErrorMessage } from "@/lib/auth/oauth-errors";
import { APP_NAME, DEMO_COOKIE } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

function clearDemoCookie() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    oauthErrorMessage(
      searchParams.get("error"),
      searchParams.get("error_description"),
    ),
  );
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <h1 className="font-display text-3xl text-forest">{APP_NAME}</h1>
        <p className="text-sm text-eggplant">
          Supabase אינו מוגדר. השתמשו במצב הדמו או הגדירו משתני סביבה.
        </p>
        <DemoEntryButton className="btn-primary px-5 py-3 text-center" />
        <LegalLinks />
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      clearDemoCookie();
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("ההתחברות נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5">
      <div>
        <h1 className="font-display text-3xl text-forest">{APP_NAME}</h1>
        <p className="text-sm text-eggplant">התחברות לחשבון</p>
      </div>

      <div className="card-surface space-y-4 p-5">
        <GoogleSignInButton onError={setError} />
        {error && (
          <p className="text-sm text-[#a33a28]" role="alert">
            {error}
          </p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-eggplant">
            התחברות עם אימייל
          </summary>
          <form onSubmit={onSubmit} className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block font-medium">אימייל</span>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">סיסמה</span>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "מתחברים…" : "התחברות"}
            </button>
          </form>
        </details>
      </div>

      <p className="text-center text-sm">
        אין חשבון?{" "}
        <Link href="/signup" className="font-semibold text-forest">
          הרשמה
        </Link>
      </p>
      <LegalLinks />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
          <p className="text-sm text-eggplant">טוענים…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
