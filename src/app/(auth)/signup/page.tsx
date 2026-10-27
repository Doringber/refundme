"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DemoEntryButton } from "@/components/auth/demo-entry-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { LegalLinks } from "@/components/legal-links";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { googleRedirectTo, safeInternalPath } from "@/lib/auth/safe-next";
import { APP_NAME, DEMO_COOKIE } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

function clearDemoCookie() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5">
        <h1 className="font-display text-4xl leading-none text-forest">פותחים שקית חדשה</h1>
        <BagMascot className="mx-auto h-36 w-36" />
        <p className="text-sm font-semibold text-eggplant">
          Supabase אינו מוגדר. השתמשו במצב הדמו.
        </p>
        <DemoEntryButton className="btn-primary w-full py-3.5 text-center" />
        <LegalLinks />
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSentTo(null);
    const address = email.trim();
    try {
      clearDemoCookie();
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: address,
        password,
        options: {
          data: { display_name: displayName.trim() || undefined },
          emailRedirectTo: googleRedirectTo(window.location.origin, next),
        },
      });
      if (authError) {
        setError(authErrorMessage(authError, "ההרשמה נכשלה. נסו שוב."));
        setBusy(false);
        return;
      }
      if (!data.session) {
        // With email confirmation on, an existing address comes back with no identities.
        if (data.user && data.user.identities?.length === 0) {
          setError("כבר יש חשבון עם האימייל הזה. נסו להתחבר.");
        } else {
          setSentTo(address);
        }
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(authErrorMessage(caught, "ההרשמה נכשלה. נסו שוב."));
      setBusy(false);
    }
  }

  const loginHref = next === "/dashboard" ? "/login" : `/login?${new URLSearchParams({ next })}`;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="page-enter">
        <p className="text-sm font-extrabold text-eggplant">{APP_NAME}</p>
        <h1 className="font-display mt-2 text-4xl leading-none text-forest">
          פותחים שקית
          <br />
          חדשה.
        </h1>
        <p className="mt-3 text-sm font-semibold text-eggplant">
          חשבון אחד, וכל הזיכויים במקום שאפשר למצוא.
        </p>
      </div>
      <BagMascot mood="happy" className="mx-auto h-36 w-36" />
      <div className="space-y-4">
        <GoogleSignInButton
          label="הרשמה עם Google"
          next={next}
          onStart={() => setError(null)}
          onError={setError}
        />
        {error && (
          <p className="text-sm font-bold text-[#a33a28]" role="alert">
            {error}
          </p>
        )}
        {sentTo && (
          <p className="text-sm font-bold text-forest" role="status">
            שלחנו קישור אישור ל־<bdi dir="ltr">{sentTo}</bdi>. פתחו אותו כדי לסיים את ההרשמה.
          </p>
        )}
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer font-bold text-eggplant">
            הרשמה עם אימייל
          </summary>
          <form onSubmit={onSubmit} className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block font-medium">שם תצוגה</span>
              <input
                className="input-field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </label>
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
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "יוצרים…" : "הרשמה"}
            </button>
          </form>
        </details>
      </div>

      <p className="text-center text-sm">
        כבר רשומים?{" "}
        <Link href={loginHref} className="font-semibold text-forest">
          התחברות
        </Link>
      </p>
      <LegalLinks />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
          <p className="text-sm text-eggplant">טוענים…</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
