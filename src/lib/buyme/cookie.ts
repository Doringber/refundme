import "server-only";

import { cookies } from "next/headers";
import {
  createBuyMeSession,
  isSessionExpired,
  type BuyMeSession,
} from "./session";

export const BUYME_SESSION_COOKIE = "zikuy_buyme_session";

/** Compact cookie payload — token only; exp derived on read. */
type CookiePayload = { v: 1; t: string; a: string };

export async function readBuyMeSessionCookie(): Promise<BuyMeSession | null> {
  const jar = await cookies();
  const raw = jar.get(BUYME_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CookiePayload;
    if (parsed?.v !== 1 || typeof parsed.t !== "string") return null;
    const session = createBuyMeSession(parsed.t);
    session.authenticatedAt = parsed.a || session.authenticatedAt;
    if (isSessionExpired(session)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function writeBuyMeSessionCookie(session: BuyMeSession): Promise<void> {
  const jar = await cookies();
  const payload: CookiePayload = {
    v: 1,
    t: session.token,
    a: session.authenticatedAt,
  };
  const maxAge =
    session.expiresAtMs != null
      ? Math.max(60, Math.floor((session.expiresAtMs - Date.now()) / 1000))
      : 60 * 60 * 24 * 30;
  jar.set(BUYME_SESSION_COOKIE, encodeURIComponent(JSON.stringify(payload)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearBuyMeSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(BUYME_SESSION_COOKIE);
}
