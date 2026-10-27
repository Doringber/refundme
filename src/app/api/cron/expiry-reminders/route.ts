import { NextResponse } from "next/server";
import { mapVoucher } from "@/lib/data/mappers";
import { siteOrigin } from "@/lib/http/site-origin";
import { logServerError } from "@/lib/log";
import { sendReminderEmail } from "@/lib/notifications/email-reminder";
import { pushPayload } from "@/lib/notifications/reminder-message";
import { DEFAULT_REMINDER_DAYS } from "@/lib/notifications/reminder-days";
import {
  addDaysIso,
  jerusalemDateIso,
  jerusalemToday,
  planExpiryReminders,
  type HouseholdMembers,
  type PlannedReminder,
  type ReminderPerson,
} from "@/lib/notifications/reminder-plan";
import { sendWebPush, type PushSubscriptionKeys } from "@/lib/notifications/web-push";
import { secretsMatch } from "@/lib/security/secret-compare";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 26;

const FALLBACK_ORIGIN = "https://justrefundme.netlify.app";
const SEND_CAP = 200;

function schemaMissing(message: string | undefined): boolean {
  if (!message) return false;
  return /does not exist|schema cache|Could not find the/i.test(message);
}

type Counts = {
  considered: number;
  pushSent: number;
  emailSent: number;
  skipped: number;
  pushUnconfigured: number;
  emailUnconfigured: number;
  failed: number;
};

/**
 * Daily expiry reminders. Header: x-cron-secret = CRON_SECRET.
 * Push when the person has a subscription; otherwise email if that fallback is on.
 */
export async function POST(request: Request) {
  if (!secretsMatch(process.env.CRON_SECRET, request.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_unconfigured" }, { status: 503 });
  }

  const today = jerusalemToday();
  const todayIso = jerusalemDateIso();
  const horizon = addDaysIso(todayIso, 366);

  const [voucherRes, profileRes, memberRes, pushRes, sentRes] = await Promise.all([
    admin
      .from("vouchers")
      .select("*")
      .gte("expiry_date", todayIso)
      .lte("expiry_date", horizon)
      .eq("expiry_confidence", "confirmed")
      .in("status", ["active", "partially_redeemed"])
      .gt("remaining_amount_agorot", 0),
    admin.from("profiles").select("id, reminder_days, email, email_reminders"),
    admin.from("household_members").select("household_id, user_id"),
    admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth_key"),
    admin
      .from("reminder_deliveries")
      .select("user_id, voucher_id, threshold_days")
      .eq("sent_on", todayIso),
  ]);

  const firstError =
    voucherRes.error ||
    profileRes.error ||
    memberRes.error ||
    pushRes.error ||
    sentRes.error;
  if (firstError) {
    logServerError("expiry-reminders", firstError.message);
    if (schemaMissing(firstError.message)) {
      return NextResponse.json({ error: "migration_required" }, { status: 503 });
    }
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const pushByUser = new Map<string, PushSubscriptionKeys[]>();
  for (const row of pushRes.data ?? []) {
    const list = pushByUser.get(row.user_id) ?? [];
    list.push({
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      authKey: row.auth_key,
    });
    pushByUser.set(row.user_id, list);
  }

  const people: ReminderPerson[] = (profileRes.data ?? []).map((row) => ({
    userId: row.id,
    reminderDays: Array.isArray(row.reminder_days)
      ? row.reminder_days
      : [...DEFAULT_REMINDER_DAYS],
    email: typeof row.email === "string" ? row.email : null,
    emailReminders: row.email_reminders !== false,
    hasPush: pushByUser.has(row.id),
  }));

  const grouped = new Map<string, string[]>();
  for (const row of memberRes.data ?? []) {
    const list = grouped.get(row.household_id) ?? [];
    list.push(row.user_id);
    grouped.set(row.household_id, list);
  }
  const households: HouseholdMembers[] = [...grouped.values()].map((memberIds) => ({
    memberIds,
  }));

  const alreadySent = new Set(
    (sentRes.data ?? []).map((row) =>
      `${row.user_id}:${row.voucher_id}:${row.threshold_days}`,
    ),
  );

  const planned = planExpiryReminders({
    vouchers: (voucherRes.data ?? []).map(mapVoucher),
    people,
    households,
    alreadySent,
    today,
  }).slice(0, SEND_CAP);

  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL, FALLBACK_ORIGIN);
  const counts: Counts = {
    considered: planned.length,
    pushSent: 0,
    emailSent: 0,
    skipped: 0,
    pushUnconfigured: 0,
    emailUnconfigured: 0,
    failed: 0,
  };

  for (const item of planned) {
    await deliverOne(admin, item, pushByUser.get(item.userId) ?? [], origin, todayIso, counts);
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), ...counts });
}

async function claim(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  item: PlannedReminder,
  channel: PlannedReminder["channel"],
  sentOn: string,
): Promise<"claimed" | "duplicate" | "error"> {
  const { error } = await admin.from("reminder_deliveries").insert({
    user_id: item.userId,
    voucher_id: item.voucherId,
    threshold_days: item.threshold,
    channel,
    sent_on: sentOn,
  });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  logServerError("expiry-reminders", error.message);
  return "error";
}

async function release(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  item: PlannedReminder,
  sentOn: string,
): Promise<void> {
  await admin
    .from("reminder_deliveries")
    .delete()
    .eq("user_id", item.userId)
    .eq("voucher_id", item.voucherId)
    .eq("threshold_days", item.threshold)
    .eq("sent_on", sentOn);
}

async function deliverOne(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  item: PlannedReminder,
  subscriptions: PushSubscriptionKeys[],
  origin: string,
  sentOn: string,
  counts: Counts,
): Promise<void> {
  const url = `${origin}${item.path}`;
  const payload = pushPayload({
    title: item.title,
    body: item.body,
    url,
    tag: `${item.voucherId}:${item.threshold}`,
  });

  if (item.channel === "push") {
    const claimResult = await claim(admin, item, "push", sentOn);
    if (claimResult !== "claimed") {
      counts[claimResult === "duplicate" ? "skipped" : "failed"] += 1;
      return;
    }
    let sent = 0;
    let unconfigured = false;
    for (const subscription of subscriptions) {
      const result = await sendWebPush(subscription, payload);
      if (result === "sent") sent += 1;
      else if (result === "gone") {
        await admin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", item.userId)
          .eq("endpoint", subscription.endpoint);
      } else if (result === "unconfigured") unconfigured = true;
    }
    if (sent > 0) {
      counts.pushSent += 1;
      return;
    }
    await release(admin, item, sentOn);
    if (unconfigured) counts.pushUnconfigured += 1;
    if (item.emailReminders && item.email) {
      await deliverEmail(admin, item, url, sentOn, counts);
      return;
    }
    if (!unconfigured) counts.failed += 1;
    return;
  }

  await deliverEmail(admin, item, url, sentOn, counts);
}

async function deliverEmail(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  item: PlannedReminder,
  url: string,
  sentOn: string,
  counts: Counts,
): Promise<void> {
  if (!item.email) {
    counts.emailUnconfigured += 1;
    return;
  }
  const claimResult = await claim(admin, item, "email", sentOn);
  if (claimResult !== "claimed") {
    counts[claimResult === "duplicate" ? "skipped" : "failed"] += 1;
    return;
  }
  const result = await sendReminderEmail({
    to: item.email,
    title: item.title,
    body: item.body,
    url,
  });
  if (result.ok) {
    counts.emailSent += 1;
    return;
  }
  await release(admin, item, sentOn);
  if (result.reason === "email_unconfigured") counts.emailUnconfigured += 1;
  else counts.failed += 1;
}
