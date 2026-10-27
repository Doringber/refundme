import { formatIls } from "@/lib/calculations";
import { APP_NAME } from "@/lib/constants";
import type { Voucher } from "@/lib/types";

export type CalendarReminderBuild = {
  /** Apple Calendar / iPhone / Google import */
  icsBlob: Blob;
  fileName: string;
  /** Google Calendar “create event” deep link (expiry day) */
  googleUrl: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD → YYYYMMDD */
export function toIcsDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function utcStamp(now = new Date()): string {
  return [
    now.getUTCFullYear(),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
    "T",
    pad2(now.getUTCHours()),
    pad2(now.getUTCMinutes()),
    pad2(now.getUTCSeconds()),
    "Z",
  ].join("");
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  let out = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    out += `\r\n ${rest.slice(0, 74)}`;
    rest = rest.slice(74);
  }
  return out;
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function eventBlock(opts: {
  uid: string;
  stamp: string;
  startIso: string;
  summary: string;
  description: string;
  alarmDaysBefore?: number[];
}): string {
  const start = toIcsDate(opts.startIso);
  const end = toIcsDate(addDaysIso(opts.startIso, 1));
  const lines = [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${opts.stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(opts.summary)}`),
    foldIcsLine(`DESCRIPTION:${escapeIcsText(opts.description)}`),
  ];

  for (const days of opts.alarmDaysBefore ?? []) {
    if (days <= 0) continue;
    lines.push(
      "BEGIN:VALARM",
      `TRIGGER:-P${days}D`,
      "ACTION:DISPLAY",
      foldIcsLine(
        `DESCRIPTION:${escapeIcsText(`תזכורת: ${opts.summary}`)}`,
      ),
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function canAddExpiryCalendar(voucher: Voucher): boolean {
  return (
    voucher.expiryConfidence === "confirmed" &&
    Boolean(voucher.expiryDate) &&
    voucher.documentType !== "receipt" &&
    voucher.remainingAmountAgorot > 0
  );
}

export function buildExpiryCalendarReminder(
  voucher: Voucher,
  reminderDays: number[] = [30, 7, 1],
): CalendarReminderBuild | null {
  if (!canAddExpiryCalendar(voucher) || !voucher.expiryDate) return null;

  const stamp = utcStamp();
  const amount = formatIls(voucher.remainingAmountAgorot);
  const expiry = voucher.expiryDate;
  const codeLine = voucher.voucherCode
    ? `קוד: ${voucher.voucherCode}`
    : voucher.barcodeValue
      ? `ברקוד: ${voucher.barcodeValue}`
      : "";
  const description = [
    `פקיעת זיכוי ב${voucher.merchantName}`,
    `יתרה לפי הדיווח שלך: ${amount}`,
    codeLine,
    `מקור: ${APP_NAME}`,
  ]
    .filter(Boolean)
    .join("\n");

  const days = [...new Set(reminderDays)]
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => b - a);

  const events: string[] = [
    eventBlock({
      uid: `zikuy-expiry-${voucher.id}@zikuy-sheli`,
      stamp,
      startIso: expiry,
      summary: `פקיעת זיכוי — ${voucher.merchantName} ${amount}`,
      description,
      alarmDaysBefore: days,
    }),
  ];

  // Extra all-day reminder events — more reliable in Google Calendar import
  for (const d of days) {
    const reminderOn = addDaysIso(expiry, -d);
    if (reminderOn >= expiry) continue;
    events.push(
      eventBlock({
        uid: `zikuy-remind-${d}d-${voucher.id}@zikuy-sheli`,
        stamp,
        startIso: reminderOn,
        summary: `תזכורת זיכוי — ${voucher.merchantName} (עוד ${d} ימים)`,
        description: `${description}\n\nהזיכוי פג ב־${expiry}.`,
      }),
    );
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zikuy Sheli//Expiry Reminders//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  const start = toIcsDate(expiry);
  const end = toIcsDate(addDaysIso(expiry, 1));
  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: `פקיעת זיכוי — ${voucher.merchantName} ${amount}`,
    dates: `${start}/${end}`,
    details: description,
  });

  return {
    icsBlob: new Blob([ics], { type: "text/calendar;charset=utf-8" }),
    fileName: `zikuy-${voucher.merchantName.replaceAll(/\s+/g, "-")}-expiry.ics`,
    googleUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
  };
}

export function downloadIcsBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
