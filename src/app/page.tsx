import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoEntryButton } from "@/components/auth/demo-entry-button";
import { LegalLinks } from "@/components/legal-links";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabaseReady = isSupabaseConfigured();

  if (supabaseReady) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) redirect("/dashboard");
    } catch {
      // Env misconfigured at runtime — fall through to marketing page
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between px-5 pb-10 pt-10 md:max-w-xl md:px-8 md:pt-14">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 80% 0%, rgba(255,179,198,0.35), transparent 55%), radial-gradient(ellipse 70% 45% at 10% 90%, rgba(156,181,154,0.35), transparent 50%)",
        }}
      />

      <header className="text-center">
        <p className="font-display text-5xl leading-none text-forest md:text-6xl">
          {APP_NAME}
        </p>
        <p className="mt-3 text-base font-semibold text-eggplant">
          צלמו זיכוי. שמרו. אל תאבדו.
        </p>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 py-12">
        <div
          className="flex h-52 w-52 items-center justify-center md:h-60 md:w-60"
          style={{
            borderRadius: "58% 42% 48% 52% / 48% 52% 48% 52%",
            background:
              "radial-gradient(circle at 34% 28%, #fff, #dfe8da 45%, #9cb59a 78%)",
            boxShadow:
              "12px 16px 32px rgba(47,79,58,.18), inset -7px -9px 16px rgba(47,79,58,.12), inset 7px 9px 14px rgba(255,255,255,.78)",
          }}
          aria-hidden
        >
          <div
            className="flex h-[78%] w-[78%] flex-col items-center justify-center text-center"
            style={{
              borderRadius: "55% 45% 52% 48% / 50% 50% 50% 50%",
              background:
                "radial-gradient(circle at 36% 30%, #fff, #fbfcf8 60%, #eaf0e6)",
            }}
          >
            <p className="font-display text-4xl text-forest">₪</p>
            <p className="mt-1 text-xs font-bold text-eggplant">
              הזיכויים במקום אחד
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          {supabaseReady ? (
            <>
              <Link
                href="/login"
                className="btn-primary w-full py-3.5 text-center text-base md:text-lg"
              >
                התחברות עם Google
              </Link>
              <Link
                href="/signup"
                className="btn-secondary w-full py-3.5 text-center text-base md:text-lg"
              >
                יצירת חשבון
              </Link>
            </>
          ) : (
            <>
              <DemoEntryButton className="btn-primary w-full py-3.5 text-center text-base md:text-lg" />
              <p className="text-center text-xs text-eggplant">
                Supabase לא מוגדר — מצב דמו מקומי בלבד
              </p>
            </>
          )}
        </div>
      </section>

      <div className="space-y-2">
        <p className="text-center text-xs leading-relaxed text-eggplant">
          היתרה לפי הדיווח שלכם. תמונה אינה מבטיחה קבלה בקופה.
        </p>
        <LegalLinks />
      </div>
    </div>
  );
}
