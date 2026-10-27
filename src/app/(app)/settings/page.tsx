"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { LegalLinks } from "@/components/legal-links";
import { BrowserNotifyToggle } from "@/components/settings/browser-notify-toggle";
import { HouseholdCard } from "@/components/settings/household-card";
import { PushReminderCard } from "@/components/settings/push-reminder-card";
import { ReminderDaysEditor } from "@/components/settings/reminder-days-editor";
import { ThemePicker } from "@/components/settings/theme-picker";
import { LoadingBlock } from "@/components/ui/loading";
import { BuyMeConnectCard } from "@/components/vouchers/buyme-connect-card";
import {
  exitDemoMode,
  useAppData,
} from "@/lib/app-data/context";
import { BUYME_CONNECTED_MESSAGE } from "@/lib/buyme-import";
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
  const [syncBusy, setSyncBusy] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [buyMeConnected, setBuyMeConnected] = useState<boolean | null>(null);
  const [connectHint, setConnectHint] = useState<string | null>(null);
  const [waitingConnect, setWaitingConnect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/buyme/session")
      .then(async (res) => {
        const json = (await res.json()) as { connected?: boolean };
        if (!cancelled) setBuyMeConnected(Boolean(json.connected));
      })
      .catch(() => {
        if (!cancelled) setBuyMeConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type !== BUYME_CONNECTED_MESSAGE) return;
      setBuyMeConnected(true);
      setWaitingConnect(false);
      setMessage("BuyMe חובר והארנק סונכרן.");
      window.setTimeout(() => window.location.reload(), 600);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!waitingConnect) return;
    const id = window.setInterval(() => {
      void fetch("/api/buyme/session")
        .then(async (res) => {
          const json = (await res.json()) as { connected?: boolean };
          if (json.connected) window.location.reload();
        })
        .catch(() => {
          /* next tick retries */
        });
    }, 2000);
    return () => window.clearInterval(id);
  }, [waitingConnect]);

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
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-forest">הגדרות</h1>
          <p className="mt-2 text-sm font-semibold text-eggplant">
            החשבון, הצבעים, וחיבור BuyMe.
          </p>
        </div>
        <BagMascot className="h-24 w-24 shrink-0" mood="happy" />
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
          רק תאריך מאומת. ברירת המחדל היא 30, 7 ו־1 ימים לפני הפקיעה, ואפשר
          לשנות. בעמוד הזיכוי עדיין אפשר להוסיף ליומן.
        </p>
        <ReminderDaysEditor onMessage={setMessage} />
        <button
          type="button"
          className="btn-secondary min-h-11 px-4 py-2 text-sm"
          onClick={() => {
            void Promise.resolve(
              app.setProfile({ emailReminders: !app.profile.emailReminders }),
            )
              .then(() => {
                setMessage(
                  app.profile.emailReminders
                    ? "מייל הגיבוי כבוי. בלי דחיפה לא נשלח תזכורת."
                    : "אם אין התראת דחיפה, נשלח מייל.",
                );
              })
              .catch((error: unknown) => {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "שמירת מייל הגיבוי מחכה למיגרציה ב־Supabase.",
                );
              });
          }}
        >
          {app.profile.emailReminders ? "מייל גיבוי פעיל" : "מייל גיבוי כבוי"}
        </button>
        <p className="text-xs leading-relaxed text-eggplant">
          המייל יוצא רק כשאין מנוי דחיפה פעיל
          {app.profile.email ? ` אל ${app.profile.email}` : ""}. בלי שירות מייל
          בשרת התזכורת פשוט לא נשלחת.
        </p>
        <BrowserNotifyToggle
          reminderDays={app.profile.reminderDays}
          onMessage={setMessage}
        />
        <PushReminderCard onMessage={setMessage} />
      </section>

      <HouseholdCard onMessage={setMessage} />

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

      <section id="buyme" className="card-surface scroll-mt-24 space-y-3 p-5">
        <h2 className="font-display text-lg">BuyMe</h2>
        <p className="text-sm text-eggplant">
          {buyMeConnected
            ? "BuyMe מחובר. «סנכרן עכשיו» מרענן את הארנק בלי להוסיף שוב את אותן מתנות."
            : "זה המקום היחיד לחיבור. פותחים את BuyMe, מתחברים, וחוזרים לכאן לסנכרון. הסיסמה לא נשמרת אצלנו."}
        </p>
        <div className="flex flex-wrap gap-2">
          <BuyMeConnectCard
            label={buyMeConnected ? "חיבור מחדש" : "חבר את BuyMe"}
            variant={buyMeConnected ? "secondary" : "primary"}
            onOpened={(copied) => {
              setWaitingConnect(true);
              setConnectHint(
                copied
                  ? "חלון BuyMe נפתח והחיבור הועתק. התחברו שם, הדביקו בשורת הכתובת ולחצו מעבר."
                  : "חלון BuyMe נפתח, אבל ההעתקה נכשלה. לחצו שוב על «חבר את BuyMe».",
              );
            }}
          />
          <button
            type="button"
            className={`${buyMeConnected ? "btn-primary" : "btn-secondary"} px-5 py-3 text-sm`}
            disabled={syncBusy}
            onClick={() => {
              void (async () => {
                setMessage(null);
                setSyncBusy(true);
                try {
                  const res = await fetch("/api/wallet/buyme/sync", { method: "POST" });
                  const json = (await res.json()) as {
                    status?: string;
                    upserted?: number;
                    error?: string;
                  };
                  if (json.status === "login_required") {
                    setMessage("BuyMe עדיין לא מחובר. לחצו «חבר את BuyMe».");
                    return;
                  }
                  if (!res.ok || json.status !== "synced") {
                    setMessage(json.error || "הסנכרון נכשל");
                    return;
                  }
                  setMessage(
                    `הסנכרון הסתיים — ${json.upserted ?? 0} מתנות עודכנו או נוספו`,
                  );
                  window.setTimeout(() => window.location.reload(), 600);
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "הסנכרון נכשל");
                } finally {
                  setSyncBusy(false);
                }
              })();
            }}
          >
            {syncBusy ? "מסנכרנים…" : "סנכרן עכשיו"}
          </button>
          {buyMeConnected && (
            <button
              type="button"
              className="btn-secondary px-5 py-3 text-sm"
              disabled={disconnectBusy}
              onClick={() => {
                void (async () => {
                  setMessage(null);
                  setDisconnectBusy(true);
                  try {
                    const res = await fetch("/api/buyme/session", { method: "DELETE" });
                    if (!res.ok) {
                      setMessage("הניתוק לא הושלם. נסו שוב.");
                      return;
                    }
                    setBuyMeConnected(false);
                    setMessage("BuyMe נותק. האסימון השמור נמחק.");
                  } catch {
                    setMessage("הניתוק לא הושלם. נסו שוב.");
                  } finally {
                    setDisconnectBusy(false);
                  }
                })();
              }}
            >
              {disconnectBusy ? "מנתקים…" : "ניתוק BuyMe"}
            </button>
          )}
        </div>
        {connectHint && (
          <p className="text-sm font-semibold text-forest" role="status">
            {connectHint}
          </p>
        )}
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
      <LegalLinks />
    </div>
  );
}
