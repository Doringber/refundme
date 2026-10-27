"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DemoEntryButton } from "@/components/auth/demo-entry-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { LegalLinks } from "@/components/legal-links";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { oauthErrorCode } from "@/lib/auth/oauth-callback";
import { oauthErrorMessage } from "@/lib/auth/oauth-errors";
import { safeInternalPath } from "@/lib/auth/safe-next";
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
  const next = safeInternalPath(searchParams.get("next"));
  const [error, setError] = useState<string | null>(() =>
    oauthErrorMessage(
      oauthErrorCode(searchParams),
      searchParams.get("error_description"),
    ),
  );
  const [busy, setBusy] = useState(false);

  // Drop ?error= once shown so a refresh or shared link doesn't repeat it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error") && !url.searchParams.has("error_code")) return;
    for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-sm font-extrabold text-eggplant">{APP_NAME}</p>
          <h1 className="font-display mt-2 text-4xl leading-none text-forest">
            השקית בבית
            <br />
            עוד מחכה.
          </h1>
          <p className="mt-3 text-sm font-semibold text-eggplant">
            Supabase אינו מוגדר כאן. אפשר להיכנס לדמו ולראות את הזיכויים.
          </p>
        </div>
        <BagMascot className="mx-auto h-40 w-40" />
        <DemoEntryButton className="btn-primary w-full py-3.5 text-center text-base" />
        <LegalLinks />
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      clearDemoCookie();
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authErrorMessage(authError));
        setBusy(false);
        return;
      }
      // Stay busy until the next page replaces this one.
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(authErrorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="page-enter">
        <p className="text-sm font-extrabold text-eggplant">{APP_NAME}</p>
        <h1 className="font-display mt-2 text-4xl leading-none text-forest">
          השקית בבית
          <br />
          עוד מחכה.
        </h1>
        <p className="mt-3 max-w-xs text-sm font-semibold text-eggplant">
          זיכויים שנשכחים במגירה — עד שפג התוקף. בואו נשמור אותם במקום אחד.
        </p>
      </div>

      <BagMascot className="mx-auto h-44 w-44" />

      <div className="space-y-4">
        <GoogleSignInButton next={next} onStart={() => setError(null)} onError={setError} />
        {error && (
          <p className="text-sm font-bold text-[#a33a28]" role="alert">
            {error}
          </p>
        )}
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer font-bold text-eggplant">
            התחברות עם אימייל
          </summary>
          <form onSubmit={onSubmit} className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block font-medium">אימייל</span>
              <input
                type="email"
                className="input-field"
                dir="ltr"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
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
                dir="ltr"
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
        <Link
          href={next === "/dashboard" ? "/signup" : `/signup?${new URLSearchParams({ next })}`}
          className="font-semibold text-forest"
        >
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
