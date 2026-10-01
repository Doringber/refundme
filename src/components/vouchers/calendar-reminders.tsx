"use client";

import { useMemo, useState } from "react";
import {
  buildExpiryCalendarReminder,
  canAddExpiryCalendar,
  downloadIcsBlob,
} from "@/lib/calendar/expiry-reminders";
import type { Voucher } from "@/lib/types";

export function CalendarReminders({
  voucher,
  reminderDays,
}: {
  voucher: Voucher;
  reminderDays: number[];
}) {
  const [status, setStatus] = useState<string | null>(null);
  const build = useMemo(
    () => buildExpiryCalendarReminder(voucher, reminderDays),
    [voucher, reminderDays],
  );

  if (voucher.documentType === "receipt") return null;

  if (!canAddExpiryCalendar(voucher) || !build) {
    return (
      <section className="card-surface space-y-2 p-5">
        <h2 className="font-display text-lg">תזכורת ביומן</h2>
        <p className="text-sm text-eggplant">
          אפשר להוסיף ליומן רק כשיש תאריך תוקף מאומת. אשרו את התוקף בעריכת
          המסמך ואז חזרו לכאן.
        </p>
      </section>
    );
  }

  return (
    <section className="card-surface space-y-3 p-5">
      <h2 className="font-display text-lg">תזכורת ביומן</h2>
      <p className="text-sm text-eggplant">
        נוסיף אירוע פקיעה + תזכורות {reminderDays.join(", ")} ימים לפני — ליומן
        iPhone או Google.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn-primary flex-1 py-3 text-sm"
          onClick={() => {
            downloadIcsBlob(build.icsBlob, build.fileName);
            setStatus(
              "הקובץ ירד — באייפון בחרו ״הוסף ליומן״. בגוגל אפשר לייבא את ה־.ics",
            );
          }}
        >
          יומן iPhone / Apple
        </button>
        <a
          href={build.googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex-1 py-3 text-center text-sm"
          onClick={() =>
            setStatus(
              "נפתח אירוע ביומן Google — אפשר גם לייבא את קובץ ה־.ics לתזכורות נוספות",
            )
          }
        >
          יומן Google
        </a>
      </div>
      <button
        type="button"
        className="btn-secondary w-full py-2.5 text-sm"
        onClick={() => {
          downloadIcsBlob(build.icsBlob, build.fileName);
          setStatus("קובץ .ics הורד — מתאים גם לייבוא ביומן Google");
        }}
      >
        הורדת קובץ .ics
      </button>
      {status && (
        <p className="text-xs font-semibold text-eggplant" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
