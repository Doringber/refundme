import { NextResponse } from "next/server";
import {
  clearBuyMeSessionCookie,
  readBuyMeSessionCookie,
  writeBuyMeSessionCookie,
} from "@/lib/buyme/cookie";
import { createBuyMeSession, isSessionExpired } from "@/lib/buyme/session";

export const runtime = "nodejs";

/** Store BuyMe Bearer JWT in httpOnly cookie (never log the token). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 400 });
    }
    const session = createBuyMeSession(token);
    if (isSessionExpired(session)) {
      return NextResponse.json({ error: "token_expired" }, { status: 400 });
    }
    await writeBuyMeSessionCookie(session);
    return NextResponse.json({
      ok: true,
      expiresAt: session.expiresAtMs
        ? new Date(session.expiresAtMs).toISOString()
        : null,
    });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
}

export async function GET() {
  const session = await readBuyMeSessionCookie();
  if (!session) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    expiresAt: session.expiresAtMs
      ? new Date(session.expiresAtMs).toISOString()
      : null,
    authenticatedAt: session.authenticatedAt,
  });
}

export async function DELETE() {
  await clearBuyMeSessionCookie();
  return NextResponse.json({ ok: true });
}
