"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useAppData } from "@/lib/app-data/context";
import {
  createDemoHousehold,
  inviteDemoHousehold,
  leaveDemoHousehold,
  readDemoHousehold,
  revokeDemoInvite,
  subscribeDemoHousehold,
} from "@/lib/demo/household";
import type { HouseholdSnapshot } from "@/lib/types";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; household: HouseholdSnapshot | null; note: string | null }
  | { status: "error"; message: string };

async function readJson(response: Response): Promise<{
  message?: string;
  error?: string;
  url?: string;
  emailStatus?: string;
  household?: HouseholdSnapshot | null;
}> {
  return (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    url?: string;
    emailStatus?: string;
    household?: HouseholdSnapshot | null;
  };
}

export function HouseholdCard({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const app = useAppData();
  const demoHousehold = useSyncExternalStore(
    subscribeDemoHousehold,
    readDemoHousehold,
    () => null,
  );
  const [remote, setRemote] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("הבית");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRemote = useCallback(async () => {
    if (app.mode === "demo") return;
    setRemote({ status: "loading" });
    try {
      const response = await fetch("/api/household");
      const json = await readJson(response);
      if (!response.ok) {
        setRemote({
          status: "error",
          message: json.message || "לא הצלחנו לטעון את הארנק המשותף.",
        });
        return;
      }
      setRemote({ status: "ready", household: json.household ?? null, note: null });
    } catch {
      setRemote({ status: "error", message: "לא הצלחנו לטעון את הארנק המשותף." });
    }
  }, [app.mode]);

  useEffect(() => {
    let cancelled = false;
    if (app.mode === "demo") return;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadRemote();
    })();
    return () => {
      cancelled = true;
    };
  }, [app.mode, loadRemote]);

  const household = app.mode === "demo"
    ? demoHousehold
    : remote.status === "ready"
      ? remote.household
      : null;

  async function run(task: () => Promise<void> | void) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (app.mode === "demo") {
      createDemoHousehold(name);
      onMessage("נפתח ארנק משותף בדמו, על המכשיר הזה.");
      return;
    }
    const response = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name }),
    });
    const json = await readJson(response);
    if (!response.ok) {
      onMessage(json.message || "פתיחת הארנק נכשלה");
      return;
    }
    onMessage("הארנק המשותף פתוח. עכשיו אפשר להזמין.");
    await loadRemote();
  }

  async function invite() {
    if (app.mode === "demo") {
      const created = inviteDemoHousehold(email);
      setLink(created.url);
      setEmail("");
      onMessage("הקישור מוכן. בדמו הוא עובד רק על המכשיר הזה.");
      return;
    }
    const response = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", email }),
    });
    const json = await readJson(response);
    if (!response.ok || !json.url) {
      onMessage(json.message || "יצירת ההזמנה נכשלה");
      return;
    }
    setLink(json.url);
    setEmail("");
    if (json.emailStatus === "sent") onMessage("שלחנו את הקישור במייל, והוא גם כאן להעתקה.");
    else if (json.emailStatus === "unconfigured") {
      onMessage("הקישור מוכן. מייל לא הוגדר בשרת, אז מעתיקים ידנית.");
    } else if (json.emailStatus === "failed") {
      onMessage("הקישור מוכן, אבל שליחת המייל נכשלה.");
    } else onMessage("הקישור מוכן. מי שיש לו אותו יכול להצטרף.");
    await loadRemote();
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      onMessage("הקישור הועתק.");
    } catch {
      onMessage("לא הצלחנו להעתיק. אפשר לסמן את הקישור ידנית.");
    }
  }

  async function leave() {
    if (app.mode === "demo") {
      leaveDemoHousehold();
      setLink(null);
      onMessage("יצאתם מהארנק המשותף בדמו.");
      return;
    }
    const response = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave" }),
    });
    const json = await readJson(response);
    if (!response.ok) {
      onMessage(json.message || "היציאה נכשלה");
      return;
    }
    setLink(null);
    onMessage("יצאתם מהארנק המשותף.");
    await loadRemote();
  }

  async function removeMember(userId: string) {
    const response = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove-member", userId }),
    });
    const json = await readJson(response);
    if (!response.ok) {
      onMessage(json.message || "ההסרה נכשלה");
      return;
    }
    onMessage("בן הבית הוסר.");
    await loadRemote();
  }

  async function revoke(inviteId: string) {
    if (app.mode === "demo") {
      revokeDemoInvite(inviteId);
      return;
    }
    const response = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke-invite", inviteId }),
    });
    const json = await readJson(response);
    if (!response.ok) {
      onMessage(json.message || "ביטול ההזמנה נכשל");
      return;
    }
    await loadRemote();
  }

  return (
    <section className="card-surface space-y-3 p-5">
      <h2 className="font-display text-lg">ארנק משותף</h2>
      <p className="text-sm leading-relaxed text-eggplant">
        מזמינים בן או בת זוג בקישור או במייל. זיכוי שסימנתם כמשותף גלוי לשניכם.
        רק מי שהוסיף אותו עורך ומוחק. השני יכול לרשום מימוש על שמו.
      </p>
      {app.mode !== "demo" && remote.status === "loading" ? (
        <p className="text-sm text-eggplant">טוענים את הבית…</p>
      ) : null}
      {app.mode !== "demo" && remote.status === "error" ? (
        <p className="text-sm font-bold text-[#a33a28]" role="alert">
          {remote.message}
        </p>
      ) : null}
      {!household && (app.mode === "demo" || remote.status === "ready") ? (
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void run(create);
          }}
        >
          <input
            className="input-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="שם הארנק המשותף"
            maxLength={40}
          />
          <button type="submit" className="btn-primary min-h-11 px-5 py-3" disabled={busy}>
            פתיחת ארנק
          </button>
        </form>
      ) : null}
      {household ? (
        <div className="space-y-3">
          <p className="font-extrabold text-forest">
            {household.name} · {household.role === "owner" ? "אתם בעלי הארנק" : "הצטרפתם לארנק"}
          </p>
          <ul className="space-y-2">
            {household.members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2"
              >
                <div>
                  <p className="font-bold">
                    {member.displayName || member.email || "בן בית"}
                  </p>
                  <p className="text-xs text-eggplant">
                    {member.role === "owner" ? "בעלים" : "שותף"} · רואה זיכויים משותפים
                  </p>
                </div>
                {household.role === "owner" && member.role === "member" && app.mode !== "demo" ? (
                  <details>
                    <summary className="min-h-11 cursor-pointer text-xs font-bold text-eggplant">עוד</summary>
                    <button
                      type="button"
                      className="btn-secondary mt-2 min-h-11 px-3 py-2 text-xs"
                      disabled={busy}
                      onClick={() => void run(() => removeMember(member.userId))}
                    >
                      הסרה
                    </button>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
          {household.role === "owner" ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void run(invite);
              }}
            >
              <label className="block text-sm">
                <span className="mb-1 block font-bold">אימייל להזמנה (אפשר בלי)</span>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="partner@example.com"
                  autoComplete="email"
                />
              </label>
              <button type="submit" className="btn-primary min-h-11 px-5 py-3 text-sm" disabled={busy}>
                יצירת קישור הזמנה
              </button>
            </form>
          ) : null}
          {link ? (
            <div className="space-y-2 rounded-2xl bg-[var(--butter)] p-3">
              <p className="text-xs font-extrabold">הקישור מוצג פעם אחת. אל תשלחו אותו לקבוצה.</p>
              <p className="break-all text-sm font-bold">{link}</p>
              <details>
                <summary className="min-h-11 cursor-pointer text-sm font-bold">העתקה או ביטול</summary>
                <button
                  type="button"
                  className="btn-secondary mt-2 min-h-11 px-4 py-2 text-sm"
                  onClick={() => void copyLink()}
                >
                  העתקת קישור
                </button>
              </details>
            </div>
          ) : null}
          {household.invites.length > 0 ? (
            <ul className="space-y-2">
              {household.invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{invite.email || "קישור בלי מייל"} · ממתין</span>
                  {household.role === "owner" ? (
                    <button
                      type="button"
                      className="min-h-11 px-2 text-xs font-bold text-eggplant underline"
                      onClick={() => void run(() => revoke(invite.id))}
                    >
                      ביטול
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <details>
            <summary className="min-h-11 cursor-pointer text-sm font-bold text-eggplant">יציאה מהארנק</summary>
            <button
              type="button"
              className="btn-secondary mt-2 min-h-11 px-4 py-2 text-sm"
              disabled={busy}
              onClick={() => void run(leave)}
            >
              אישור יציאה
            </button>
          </details>
        </div>
      ) : null}
    </section>
  );
}
