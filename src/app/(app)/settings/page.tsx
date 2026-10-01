"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { BrowserNotifyToggle } from "@/components/settings/browser-notify-toggle";
import { ThemePicker } from "@/components/settings/theme-picker";
import { LoadingBlock } from "@/components/ui/loading";
import {
  exitDemoMode,
  useAppData,
} from "@/lib/app-data/context";
import { agorotToShekels, parseShekelInput, formatIls } from "@/lib/calculations";

export default function SettingsPage() {
  const app = useAppData();
  const router = useRouter();
  const defaultScale = app.profile.orbScaleAgorot
    ? String(agorotToShekels(app.profile.orbScaleAgorot))
    : "1000";
  const [scaleInput, setScaleInput] = useState(defaultScale);
  const [scaleTouched, setScaleTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!app.ready) return <LoadingBlock />;

  const displayScale = scaleTouched ? scaleInput : defaultScale;

  async function saveScale(e: React.FormEvent) {
    e.preventDefault();
    const agorot = parseShekelInput(displayScale);
    if (agorot === null || agorot <= 0) {
      setMessage("הזינו סכום חיובי לסולם התצוגה");
      return;
    }
    await app.setProfile({ orbScaleAgorot: agorot });
    setScaleTouched(false);
    setMessage(`סולם התצוגה עודכן ל־${formatIls(agorot)}`);
  }

  async function clearScale() {
    await app.setProfile({ orbScaleAgorot: null });
    setMessage("הסולם נוקה — הגלים דקורטיביים בלבד, ללא אחוזים");
  }

  async function handleExport() {
    setBusy(true);
    try {
      const json = await app.exportJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zikuy-sheli-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setMessage("הייצוא הורד למכשיר");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "הייצוא נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-forest">הגדרות וחשבון</h1>
        <p className="text-sm text-eggplant">
          תזכורות, סולם כדור הזיכוי, ייצוא ומחיקה
        </p>
      </div>

      <ThemePicker
        onPicked={(_id, nameHe) => setMessage(`העיצוב עודכן ל־${nameHe}`)}
      />

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">מצב נוכחי</h2>
        <div className="flex items-center gap-3">
          {app.profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.profile.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <p className="text-sm text-eggplant">
            {app.mode === "demo"
              ? "מצב דמו — הנתונים נשמרים במכשיר בלבד."
              : app.user
                ? `מחוברים כ־${app.profile.displayName ?? app.user.email ?? app.profile.email ?? "משתמש"}`
                : "מחוברים לענן אך אין סשן — יש להתחבר כדי לשמור נתונים."}
          </p>
        </div>
        {app.mode === "supabase" && app.user?.email && (
          <p className="text-xs text-eggplant">{app.user.email}</p>
        )}
        {app.mode === "supabase" && !app.user && (
          <Link href="/login" className="btn-primary inline-flex px-5 py-2.5">
            התחברות
          </Link>
        )}
        {app.mode === "supabase" && app.user && (
          <button
            type="button"
            className="btn-secondary px-4 py-2"
            onClick={() =>
              void app.signOut().then(() => {
                router.push("/");
                router.refresh();
              })
            }
          >
            התנתקות
          </button>
        )}
        {app.mode === "demo" && (
          <button
            type="button"
            className="btn-secondary px-4 py-2"
            onClick={() => exitDemoMode()}
          >
            יציאה מדמו
          </button>
        )}
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">סולם תצוגה אישי לכדור</h2>
        <p className="text-sm text-eggplant">
          אופציונלי. מסמן כמה מהסכום שבחרתם מולאו הגלים — לדוגמה מתוך ₪1,000.
          בלי סולם הגלים דקורטיביים ואין אחוזים.
        </p>
        <form onSubmit={(e) => void saveScale(e)} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input-field"
            inputMode="decimal"
            value={displayScale}
            onChange={(e) => {
              setScaleTouched(true);
              setScaleInput(e.target.value);
            }}
            aria-label="סכום סולם בשקלים"
          />
          <button type="submit" className="btn-primary px-5 py-3">
            שמירה
          </button>
        </form>
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm"
          onClick={() => void clearScale()}
        >
          ניקוי סולם
        </button>
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">תזכורות תוקף</h2>
        <p className="text-sm text-eggplant">
          תזכורות מבוססות על תאריך מאומת בלבד. בעמוד הזיכוי אפשר להוסיף ליומן
          iPhone / Apple (קובץ .ics) או ליומן Google — עם תזכורות{" "}
          {app.profile.reminderDays.join(", ")} ימים לפני הפקיעה.
        </p>
        <p className="text-sm font-medium">
          ימים לפני פקיעה: {app.profile.reminderDays.join(", ")}
        </p>
        <BrowserNotifyToggle
          reminderDays={app.profile.reminderDays}
          onMessage={setMessage}
        />
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">ייצוא נתונים</h2>
        <p className="text-sm text-eggplant">
          הורדת JSON של הזיכויים, המימושים והפעילות. היתרות מסומנות כיתרה לפי
          הדיווח שלך.
        </p>
        <button
          type="button"
          className="btn-primary px-5 py-3"
          onClick={() => void handleExport()}
          disabled={busy}
        >
          ייצוא JSON
        </button>
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">BuyMe</h2>
        <p className="text-sm text-eggplant">
          האפליקציה לא מחליפה את BuyMe — היא עוזרת לעקוב אחרי יתרות. צלמו או
          צלמו־מסך את השובר מ־buyme.co.il / האפליקציה, שמרו עם חנות{" "}
          <span className="font-extrabold text-foreground">BuyMe</span> והקוד.
          המימוש עצמו נעשה בקופה או באתר של בית העסק עם הקוד של BuyMe; אחר כך
          רשמו כאן מימוש כדי לעדכן את היתרה.
        </p>
        <a
          href="https://buyme.co.il"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex px-4 py-2 text-sm"
        >
          פתיחת buyme.co.il
        </a>
      </section>

      {app.mode === "demo" ? (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg">מצב דמו</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={() => {
                app.reset();
                setMessage("נתוני הדמו אופסו");
              }}
            >
              איפוס נתוני דמו
            </button>
            <button
              type="button"
              className="btn-danger px-4 py-2"
              onClick={() => {
                if (confirm("למחוק את כל נתוני הדמו מהמכשיר?")) {
                  void Promise.resolve(app.wipe()).then(() => {
                    app.reset();
                    setMessage("הנתונים נמחקו ונטענו מחדש");
                  });
                }
              }}
            >
              מחיקת נתוני דמו
            </button>
          </div>
        </section>
      ) : (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg">מחיקת חשבון</h2>
          <p className="text-sm text-eggplant">
            מוחק את כל הזיכויים, המסמכים והחשבון מהשרת. פעולה זו בלתי הפיכה.
          </p>
          <button
            type="button"
            className="btn-danger px-4 py-2"
            disabled={!app.user || busy}
            onClick={() => {
              if (
                confirm(
                  "למחוק לצמיתות את החשבון ואת כל הנתונים? לא ניתן לשחזר.",
                )
              ) {
                setBusy(true);
                void Promise.resolve(app.wipe())
                  .then(() => {
                    router.push("/");
                    router.refresh();
                  })
                  .catch((err: unknown) => {
                    setMessage(
                      err instanceof Error ? err.message : "מחיקת החשבון נכשלה",
                    );
                    setBusy(false);
                  });
              }
            }}
          >
            מחיקת חשבון לצמיתות
          </button>
        </section>
      )}

      {message && (
        <p className="rounded-2xl bg-[rgba(71,181,168,0.14)] px-4 py-3 text-sm" role="status">
          {message}
        </p>
      )}

      {app.error && (
        <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="alert">
          {app.error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-eggplant">
        בלי אינטגרציית סוחרים, אין יתרה מאומתת מול הקופה ואין מימוש NFC. המודל
        מוכן להרחבה עתידית.
      </p>
    </div>
  );
}
