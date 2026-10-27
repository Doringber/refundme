import { NextResponse } from "next/server";
import { BUYME_CATALOGS } from "@/lib/stores/lookup";
import { refreshCatalogNow } from "@/lib/stores/nearby-service";
import { bundledCatalogFetchedAt, bundledCatalogSource } from "@/lib/stores/catalog-snapshot";
import { secretsMatch } from "@/lib/security/secret-compare";

export const runtime = "nodejs";
export const maxDuration = 26;

/**
 * Refresh the four public BuyMe brand lists.
 * Header: x-cron-secret = CRON_SECRET.
 * Schedule about every 12 hours. The nearby search also refreshes a stale
 * list after it responds, and serves the bundled snapshot when this table
 * has not been created yet.
 */
export async function POST(request: Request) {
  if (!secretsMatch(process.env.CRON_SECRET, request.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const started = Date.now();
  const catalogs = await Promise.all(BUYME_CATALOGS.map((catalog) => refreshCatalogNow(catalog.id)));
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    source: bundledCatalogSource(),
    bundledFetchedAt: bundledCatalogFetchedAt(),
    ttlHours: 12,
    catalogs,
  });
}
