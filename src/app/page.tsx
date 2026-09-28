import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function HomePage() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-0 pt-6 md:px-8 md:pt-8">
      <header className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="text-right">
          <p className="font-display text-3xl leading-none text-forest md:text-4xl">
            {APP_NAME}
          </p>
          <p className="mt-2 text-sm font-medium text-eggplant">
            זיכויים · שוברים · תוקף במקום אחד
          </p>
        </div>
        <div className="chip-row">
          <span className="badge bg-blush text-night">מצב דמו</span>
          <span className="badge bg-dusty-blue text-night">עברית RTL</span>
        </div>
      </header>

      <section className="relative z-10 mt-10 grid flex-1 items-center gap-10 md:mt-14 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-12">
        <div className="order-2 space-y-5 md:order-1">
          <div className="chip-row">
            <span className="badge bg-mint-chip text-forest-deep">צילום</span>
            <span className="badge bg-rose text-night">אישור פרטים</span>
            <span className="badge bg-lime-chip text-night">מעקב יתרה</span>
            <span className="badge bg-dusty-blue text-night">תוקף</span>
          </div>

          <h1 className="font-display text-4xl leading-[1.25] text-forest md:text-5xl lg:text-6xl">
            הזיכויים שלכם.
            <br />
            בלי לאבד שוברים.
          </h1>

          <p className="max-w-md text-base font-medium leading-relaxed text-night/80 md:text-lg">
            צלמו זיכוי נייר, אשרו את הפרטים — ותראו מיד כמה נשאר, איפה לממש, ומה
            פג בקרוב.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard"
              className="btn-primary px-7 py-3.5 text-base md:text-lg"
            >
              כניסה למצב דמו
            </Link>
            {supabaseReady ? (
              <Link
                href="/login"
                className="btn-secondary px-7 py-3.5 text-base md:text-lg"
              >
                התחברות לחשבון
              </Link>
            ) : (
              <Link
                href="/vouchers/new"
                className="btn-secondary px-7 py-3.5 text-base md:text-lg"
              >
                הוספת זיכוי
              </Link>
            )}
          </div>
        </div>

        <div className="order-1 flex justify-center md:order-2 md:justify-end">
          <div
            className="relative flex h-64 w-64 items-center justify-center md:h-80 md:w-80"
            style={{
              borderRadius: "58% 42% 48% 52% / 48% 52% 48% 52%",
              background:
                "linear-gradient(155deg, rgba(94,150,107,0.35), rgba(163,193,226,0.45), rgba(244,189,190,0.4))",
              boxShadow: "0 24px 50px rgba(42,75,60,0.12)",
            }}
            aria-hidden
          >
            <div
              className="flex h-[78%] w-[78%] flex-col items-center justify-center bg-white/80 text-center shadow-sm"
              style={{
                borderRadius: "55% 45% 52% 48% / 50% 50% 50% 50%",
              }}
            >
              <p className="text-sm font-semibold text-eggplant">זיכויים זמינים</p>
              <p className="font-display mt-1 text-5xl text-forest md:text-6xl">
                ₪480
              </p>
              <p className="mt-2 text-xs font-medium text-eggplant">
                יתרה לפי הדיווח שלך
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mt-12 organic-curve bg-forest px-6 pb-10 pt-12 text-center text-cream-ink md:mt-16 md:rounded-t-[6rem] md:px-10 md:pt-16">
        <p className="font-display text-2xl leading-snug md:text-3xl">
          שמרו על הזיכויים.
          <br />
          לפני שהם נעלמים מהארנק.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream-ink/85">
          היתרה המוצגת היא לפי הדיווח שלכם. תמונה של שובר אינה מבטיחה קבלה בכל
          קופה. אין מימוש NFC או אינטגרציית רשתות בחנויות בגרסה זו.
        </p>
        {supabaseReady && (
          <Link
            href="/signup"
            className="mt-6 inline-flex rounded-full bg-blush px-6 py-3 text-sm font-bold text-night"
          >
            יצירת חשבון חדש
          </Link>
        )}
      </footer>
    </div>
  );
}
