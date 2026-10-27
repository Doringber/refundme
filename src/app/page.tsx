import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoEntryButton } from "@/components/auth/demo-entry-button";
import { BagMascot } from "@/components/illustrations/bag-mascot";
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
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] md:max-w-xl md:px-8">
      <header>
        <p className="text-sm font-extrabold text-eggplant">{APP_NAME}</p>
        <h1 className="font-display mt-3 text-5xl leading-none text-forest">
          הזיכויים
          <br />
          לא הולכים לאיבוד.
        </h1>
        <p className="mt-4 max-w-sm text-base font-semibold text-eggplant">
          שקית של שוברים דהויים בבית — עכשיו במקום אחד, לפני שפג התוקף.
        </p>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
        <BagMascot className="h-52 w-52" />
        <div className="flex w-full max-w-sm flex-col gap-3">
          {supabaseReady ? (
            <Link
              href="/login"
              className="btn-primary w-full py-3.5 text-center text-base md:text-lg"
            >
              המשך עם Google
            </Link>
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
