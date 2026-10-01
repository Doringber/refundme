import { NextResponse } from "next/server";
import { readBuyMeSessionCookie } from "@/lib/buyme/cookie";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { saveBuyMeConnection } from "@/lib/wallet/connection-store";
import { syncBuyMeForStoredSession, syncBuyMeWallet } from "@/lib/wallet/buyme-sync";

export const runtime = "nodejs";

/** Manual "Sync now" — uses stored session, or the httpOnly cookie from connect. */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "error", error: "demo_mode" },
      { status: 400 },
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "unauthorized" }, { status: 401 });
  }

  const cookie = await readBuyMeSessionCookie();
  if (cookie?.token) {
    await saveBuyMeConnection({
      userId: user.id,
      token: cookie.token,
      expiresAt: cookie.expiresAtMs
        ? new Date(cookie.expiresAtMs).toISOString()
        : null,
    });
    const report = await syncBuyMeWallet(user.id, cookie.token);
    return NextResponse.json(report, {
      status: report.status === "synced" ? 200 : report.status === "login_required" ? 401 : 502,
    });
  }

  const report = await syncBuyMeForStoredSession(user.id);
  return NextResponse.json(report, {
    status: report.status === "synced" ? 200 : report.status === "login_required" ? 401 : 502,
  });
}
