import { NextResponse } from "next/server";
import { logServerError } from "@/lib/log";
import { secretsMatch } from "@/lib/security/secret-compare";
import { listConnectedBuyMeUserIds } from "@/lib/wallet/connection-store";
import { syncBuyMeForStoredSession } from "@/lib/wallet/buyme-sync";

export const runtime = "nodejs";

/**
 * Scheduled refresh (every 6 hours from an external cron / Netlify schedule).
 * Header: x-cron-secret = CRON_SECRET
 */
export async function POST(request: Request) {
  if (!secretsMatch(process.env.CRON_SECRET, request.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userIds = await listConnectedBuyMeUserIds();
  const results = [];
  for (const userId of userIds) {
    try {
      results.push({ userId, ...(await syncBuyMeForStoredSession(userId)) });
    } catch (error) {
      logServerError("buyme-cron", error);
      results.push({
        userId,
        provider: "buyme" as const,
        status: "error" as const,
        upserted: 0,
        error: "sync_threw",
      });
    }
  }
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    count: results.length,
    loginRequired: results.filter((r) => r.status === "login_required").length,
    synced: results.filter((r) => r.status === "synced").length,
    failed: results.filter((r) => r.status === "error").length,
  });
}
