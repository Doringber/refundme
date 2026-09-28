"use client";

import { useState } from "react";
import { LoadingBlock } from "@/components/ui/loading";
import { agorotToShekels, parseShekelInput, formatIls } from "@/lib/calculations";
import { useDemo } from "@/lib/demo/context";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SettingsPage() {
  const demo = useDemo();
  const [scaleInput, setScaleInput] = useState(
    demo.profile.orbScaleAgorot
      ? String(agorotToShekels(demo.profile.orbScaleAgorot))
      : "1000",
  );
  const [message, setMessage] = useState<string | null>(null);

  if (!demo.ready) return <LoadingBlock />;

  function saveScale(e: React.FormEvent) {
    e.preventDefault();
    const agorot = parseShekelInput(scaleInput);
    if (agorot === null || agorot <= 0) {
      setMessage("הזינו סכום חיובי לסולם התצוגה");
      return;
    }
    demo.setProfile({ orbScaleAgorot: agorot });
    setMessage(`סולם התצוגה עודכן ל־${formatIls(agorot)}`);
  }

  function clearScale() {
    demo.setProfile({ orbScaleAgorot: null });
    setMessage("הסולם נוקה — הגלים דקורטיביים בלבד, ללא אחוזים");
  }

  function handleExport() {
    const json = demo.exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zikuy-sheli-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setMessage("הייצוא הורד למכשיר");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-forest">הגדרות וחשבון</h1>
        <p className="text-sm text-eggplant">
          תזכורות, סולם כדור הזיכוי, ייצוא ומחיקה
        </p>
      </div>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">סולם תצוגה אישי לכדור</h2>
        <p className="text-sm text-eggplant">
          אופציונלי. מסמן כמה מהסכום שבחרתם מולאו הגלים — לדוגמה מתוך ₪1,000.
          בלי סולם הגלים דקורטיביים ואין אחוזים.
        </p>
        <form onSubmit={saveScale} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input-field"
            inputMode="decimal"
            value={scaleInput}
            onChange={(e) => setScaleInput(e.target.value)}
            aria-label="סכום סולם בשקלים"
          />
          <button type="submit" className="btn-primary px-5 py-3">
            שמירה
          </button>
        </form>
        <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={clearScale}>
          ניקוי סולם
        </button>
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">תזכורות תוקף</h2>
        <p className="text-sm text-eggplant">
          תזכורות מבוססות על תאריך מאומת בלבד. אם התוקף חסר או לא ודאי —
          תוצג ההודעה ״תוקף לא אומת״ ולא תומצא ספירה לאחור.
        </p>
        <p className="text-sm font-medium">
          ימים לפני פקיעה:{" "}
          {demo.profile.reminderDays.join(", ")}
        </p>
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">ייצוא נתונים</h2>
        <p className="text-sm text-eggplant">
          הורדת JSON של הזיכויים, המימושים והפעילות. היתרות מסומנות כיתרה לפי
          הדיווח שלך.
        </p>
        <button type="button" className="btn-primary px-5 py-3" onClick={handleExport}>
          ייצוא JSON
        </button>
        {isSupabaseConfigured() && (
          <a href="/api/export" className="btn-secondary inline-flex px-5 py-3">
            ייצוא מהשרת
          </a>
        )}
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">מצב דמו</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary px-4 py-2"
            onClick={() => {
              demo.reset();
              setMessage("נתוני הדמו אופסו לדוגמאות");
            }}
          >
            איפוס לדמו לדוגמה
          </button>
          <button
            type="button"
            className="btn-danger px-4 py-2"
            onClick={() => {
              if (confirm("למחוק את כל נתוני הדמו מהמכשיר?")) {
                demo.wipe();
                demo.reset();
                setMessage("הנתונים נמחקו ונטענו מחדש");
              }
            }}
          >
            מחיקת נתוני דמו
          </button>
        </div>
      </section>

      {message && (
        <p className="rounded-2xl bg-[rgba(71,181,168,0.14)] px-4 py-3 text-sm" role="status">
          {message}
        </p>
      )}

      <p className="text-xs leading-relaxed text-eggplant">
        בלי אינטגרציית סוחרים, אין יתרה מאומתת מול הקופה ואין מימוש NFC. המודל
        מוכן להרחבה עתידית.
      </p>
    </div>
  );
}
