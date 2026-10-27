import "server-only";

import { logServerError } from "@/lib/log";

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  authKey: string;
};

export type PushSendResult = "sent" | "gone" | "unconfigured" | "failed";

export function vapidPublicKey(): string | undefined {
  const value =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim();
  return value || undefined;
}

export function vapidConfigured(): boolean {
  return Boolean(
    vapidPublicKey() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim(),
  );
}

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: string,
): Promise<PushSendResult> {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return "unconfigured";

  try {
    const loaded = (await import("web-push")) as {
      setVapidDetails?: (
        subject: string,
        publicKey: string,
        privateKey: string,
      ) => void;
      sendNotification?: (
        subscription: {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        },
        payload: string,
      ) => Promise<void>;
      default?: {
        setVapidDetails: (
          subject: string,
          publicKey: string,
          privateKey: string,
        ) => void;
        sendNotification: (
          subscription: {
            endpoint: string;
            keys: { p256dh: string; auth: string };
          },
          payload: string,
        ) => Promise<void>;
      };
    };
    const webpush = loaded.setVapidDetails ? loaded : loaded.default;
    if (!webpush?.setVapidDetails || !webpush.sendNotification) return "failed";
    webpush.setVapidDetails(subject, publicKey, privateKey);
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.authKey },
      },
      payload,
    );
    return "sent";
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 0;
    if (status === 404 || status === 410) return "gone";
    logServerError("web-push", `status ${status || "unknown"}`);
    return "failed";
  }
}
