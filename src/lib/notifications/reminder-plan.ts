import { daysUntil, formatIls, isSpendable } from "@/lib/calculations";
import { APP_NAME } from "@/lib/constants";
import type { Voucher } from "@/lib/types";
import { matchingReminderThreshold } from "./expiry-alerts";
import { normalizeReminderDays } from "./reminder-days";

export type ReminderChannel = "push" | "email";

export type ReminderPerson = {
  userId: string;
  reminderDays: number[];
  email: string | null;
  emailReminders: boolean;
  hasPush: boolean;
};

export type HouseholdMembers = {
  memberIds: string[];
};

export type PlannedReminder = {
  userId: string;
  voucherId: string;
  threshold: number;
  daysLeft: number;
  channel: ReminderChannel;
  email: string | null;
  emailReminders: boolean;
  title: string;
  body: string;
  path: string;
};

export function jerusalemDateIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

/** Noon on the Jerusalem calendar day, so day-counts do not follow the server zone. */
export function jerusalemToday(now = new Date()): Date {
  return new Date(`${jerusalemDateIso(now)}T12:00:00`);
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function preferredReminderChannel(
  person: Pick<ReminderPerson, "hasPush" | "emailReminders" | "email">,
): ReminderChannel | null {
  if (person.hasPush) return "push";
  if (person.emailReminders && person.email) return "email";
  return null;
}

export function reminderDedupeKey(
  userId: string,
  voucherId: string,
  threshold: number,
): string {
  return `${userId}:${voucherId}:${threshold}`;
}

function alertCopy(voucher: Voucher, daysLeft: number): { title: string; body: string } {
  const amount = formatIls(voucher.remainingAmountAgorot);
  const title =
    daysLeft < 0
      ? `פג תוקף — ${voucher.merchantName}`
      : daysLeft === 0
        ? `פקיעה היום — ${voucher.merchantName}`
        : `תזכורת זיכוי — ${voucher.merchantName}`;
  const body =
    daysLeft < 0
      ? `${amount} פג לפני ${Math.abs(daysLeft)} ימים · ${APP_NAME}`
      : daysLeft === 0
        ? `${amount} פג היום · ${APP_NAME}`
        : `${amount} · עוד ${daysLeft} ימים עד הפקיעה · ${APP_NAME}`;
  return { title, body };
}

function recipientsFor(
  voucher: Voucher,
  people: ReminderPerson[],
  households: HouseholdMembers[],
): ReminderPerson[] {
  const ids = new Set<string>([voucher.userId]);
  if (voucher.shared) {
    const home = households.find((group) => group.memberIds.includes(voucher.userId));
    for (const memberId of home?.memberIds ?? []) ids.add(memberId);
  }
  const byId = new Map(people.map((person) => [person.userId, person]));
  const out: ReminderPerson[] = [];
  for (const id of ids) {
    const person = byId.get(id);
    if (person) out.push(person);
  }
  return out;
}

/**
 * Who should hear about a confirmed, spendable voucher today.
 * Push wins when a subscription exists. Email is only the fallback.
 * The same user/voucher/threshold is skipped when `alreadySent` contains it,
 * so a daily job does not repeat the 30-day notice on day 29.
 */
export function planExpiryReminders(input: {
  vouchers: Voucher[];
  people: ReminderPerson[];
  households: HouseholdMembers[];
  alreadySent: ReadonlySet<string>;
  today?: Date;
}): PlannedReminder[] {
  const today = input.today ?? jerusalemToday();
  const planned: PlannedReminder[] = [];

  for (const voucher of input.vouchers) {
    if (!isSpendable(voucher)) continue;
    if (voucher.expiryConfidence !== "confirmed" || !voucher.expiryDate) continue;
    const daysLeft = daysUntil(voucher.expiryDate, today);
    if (daysLeft === null || daysLeft < 0) continue;

    for (const person of recipientsFor(voucher, input.people, input.households)) {
      const threshold = matchingReminderThreshold(
        daysLeft,
        normalizeReminderDays(person.reminderDays),
      );
      if (threshold === null) continue;
      const key = reminderDedupeKey(person.userId, voucher.id, threshold);
      if (input.alreadySent.has(key)) continue;
      const channel = preferredReminderChannel(person);
      if (!channel) continue;
      const copy = alertCopy(voucher, daysLeft);
      planned.push({
        userId: person.userId,
        voucherId: voucher.id,
        threshold,
        daysLeft,
        channel,
        email: person.email,
        emailReminders: person.emailReminders,
        title: copy.title,
        body: copy.body,
        path: channel === "push" ? "/stores/near" : `/vouchers/${voucher.id}`,
      });
    }
  }

  return planned.sort((a, b) => a.daysLeft - b.daysLeft || a.userId.localeCompare(b.userId));
}
