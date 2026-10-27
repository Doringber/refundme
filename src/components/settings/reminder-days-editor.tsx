"use client";

import { useState } from "react";
import { useAppData } from "@/lib/app-data/context";
import {
  normalizeReminderDays,
  REMINDER_DAY_CHOICES,
} from "@/lib/notifications/reminder-days";

export function ReminderDaysEditor({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const app = useAppData();
  const [days, setDays] = useState(() => normalizeReminderDays(app.profile.reminderDays));
  const [busy, setBusy] = useState(false);

  function toggle(day: number) {
    setDays((current) => {
      const next = current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day];
      return [...new Set(next)].sort((a, b) => b - a);
    });
  }

  async function save() {
    setBusy(true);
    try {
      const next = normalizeReminderDays(days);
      await app.setProfile({ reminderDays: next });
      onMessage(`נזכיר ${next.join(", ")} ימים לפני הפקיעה`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "שמירת הימים נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {REMINDER_DAY_CHOICES.map((day) => {
          const on = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              className={`min-h-11 rounded-full border-2 px-4 text-sm font-extrabold ${
                on
                  ? "border-[#1c1c1c] bg-[var(--butter)] text-[#1c1c1c]"
                  : "border-[rgba(28,28,28,0.15)] bg-white/70 text-eggplant"
              }`}
              onClick={() => toggle(day)}
            >
              {day} ימים
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn-secondary min-h-11 px-4 py-2 text-sm"
        disabled={busy || days.length === 0}
        onClick={() => void save()}
      >
        {busy ? "שומרים…" : "שמירת ימי התזכורת"}
      </button>
    </div>
  );
}
