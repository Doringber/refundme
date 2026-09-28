import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function HomePage() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-between px-5 pb-10 pt-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] overflow-hidden"
      >
        <div
          className="absolute -left-16 top-10 h-56 w-56 rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(circle, rgba(71,181,168,0.45), transparent 70%)",
          }}
        />
        <div
          className="absolute -right-10 top-24 h-64 w-64 rounded-full opacity-80"
          style={{
            background:
              "radial-gradient(circle, rgba(219,192,232,0.55), transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(circle, rgba(247,226,137,0.55), transparent 70%)",
          }}
        />
      </div>

      <header className="relative z-10">
        <p className="font-display text-5xl font-semibold leading-none text-night md:text-6xl">
          {APP_NAME}
        </p>
        <p className="mt-4 max-w-md text-lg text-eggplant">
          צלמו זיכוי נייר, אשרו את הפרטים — ותראו מיד כמה נשאר, איפה לממש, ומה
          פג בקרוב.
        </p>
      </header>

      <section className="relative z-10 mt-12 flex flex-col gap-3">
        <Link href="/dashboard" className="btn-primary px-6 py-4 text-center text-lg">
          כניסה למצב דמו
        </Link>
        {supabaseReady ? (
          <>
            <Link
              href="/login"
              className="btn-secondary px-6 py-4 text-center text-lg"
            >
              התחברות לחשבון
            </Link>
            <Link
              href="/signup"
              className="text-center text-sm font-semibold text-night underline-offset-4 hover:underline"
            >
              יצירת חשבון חדש
            </Link>
          </>
        ) : (
          <p className="text-center text-sm text-eggplant">
            אין חיבור ל־Supabase — מצב הדמו עובד במלואו במכשיר זה.
          </p>
        )}
      </section>

      <footer className="relative z-10 mt-10 text-xs leading-relaxed text-eggplant">
        <p>
          היתרה המוצגת היא לפי הדיווח שלכם. תמונה של שובר אינה מבטיחה קבלה בכל
          קופה. אין מימוש NFC או אינטגרציית רשתות בחנויות בגרסה זו.
        </p>
      </footer>
    </div>
  );
}
