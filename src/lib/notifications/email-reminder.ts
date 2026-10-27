import "server-only";

import { logServerError } from "@/lib/log";
import { reminderEmail } from "./reminder-message";

export type EmailSendResult =
  | { ok: true }
  | { ok: false; reason: "email_unconfigured" | "email_failed" };

/** Resend HTTPS API. No key or from-address means the cron skips email. */
export async function sendReminderEmail(input: {
  to: string;
  title: string;
  body: string;
  url: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_EMAIL_FROM?.trim();
  if (!apiKey || !from) return { ok: false, reason: "email_unconfigured" };

  const message = reminderEmail(input);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) {
      logServerError("reminder-email", `resend status ${response.status}`);
      return { ok: false, reason: "email_failed" };
    }
    return { ok: true };
  } catch (error) {
    logServerError("reminder-email", error);
    return { ok: false, reason: "email_failed" };
  }
}

export async function sendHouseholdInviteEmail(input: {
  to: string;
  url: string;
  householdName: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_EMAIL_FROM?.trim();
  if (!apiKey || !from) return { ok: false, reason: "email_unconfigured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: "הזמנה לארנק המשותף בזיכוי שלי",
        text: `מזמינים אותך לארנק «${input.householdName}» בזיכוי שלי.\n\n${input.url}\n\nהקישור תקף ל־14 יום. מי שיש לו את הקישור יכול להצטרף, אז עדיף לא לפרסם אותו.\n`,
      }),
    });
    if (!response.ok) {
      logServerError("household-invite-email", `resend status ${response.status}`);
      return { ok: false, reason: "email_failed" };
    }
    return { ok: true };
  } catch (error) {
    logServerError("household-invite-email", error);
    return { ok: false, reason: "email_failed" };
  }
}
