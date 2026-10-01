import { NextResponse } from "next/server";
import { listConnectedBuyMeUserIds } from "@/lib/wallet/connection-store";
import { syncBuyMeForStoredSession } from "@/lib/wallet/buyme-sync";

export const runtime = "nodejs";

/**
 * Scheduled refresh (every 6 hours from an external cron / Netlify schedule).
 * Header: x-cron-secret = CRON_SECRET
 */
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const got = request.headers.get("x-cron-secret");
  if (!expected || got !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userIds = await listConnectedBuyMeUserIds();
  const results = [];
  for (const userId of userIds) {
    results.push({ userId, ...(await syncBuyMeForStoredSession(userId)) });
  }
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    count: results.length,
    loginRequired: results.filter((r) => r.status === "login_required").length,
    synced: results.filter((r) => r.status === "synced").length,
  });
}
