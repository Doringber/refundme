import { NextResponse } from "next/server";
import {
  clearBuyMeSessionCookie,
  readBuyMeSessionCookie,
  writeBuyMeSessionCookie,
} from "@/lib/buyme/cookie";
import { createBuyMeSession, isSessionExpired } from "@/lib/buyme/session";
import { createClient } from "@/lib/supabase/server";
import { saveBuyMeConnection } from "@/lib/wallet/connection-store";

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
    const expiresAt = session.expiresAtMs
      ? new Date(session.expiresAtMs).toISOString()
      : null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await saveBuyMeConnection({
          userId: user.id,
          token: session.token,
          expiresAt,
        });
      }
    } catch {
      // Cookie session still works if Supabase persistence is unavailable.
    }
    return NextResponse.json({ ok: true, expiresAt });
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
