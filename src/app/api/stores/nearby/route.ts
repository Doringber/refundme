import { after, NextResponse } from "next/server";
import { isBuyMeCatalogId } from "@/lib/stores/lookup";
import {
  catalogLabel,
  geocodePlace,
  loadCatalog,
  lookupCatalogs,
  lookupMerchant,
  refreshStaleCatalogs,
} from "@/lib/stores/nearby-service";
import { NEARBY_BUDGET_MS } from "@/lib/stores/search";
import { getSupabasePublicEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const MAX_CATALOGS = 4;

function finiteCoord(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

function cleanMerchantName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

/**
 * Saved chain branches are written only for a signed-in user who holds a
 * voucher for that merchant, so random names cannot fill the shared table.
 */
function ownsMerchantVoucher(merchantName: string): () => Promise<boolean> {
  let pending: Promise<boolean> | null = null;
  return () => {
    pending ??= (async () => {
      if (!getSupabasePublicEnv()) return false;
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return false;
        const { data, error } = await supabase
          .from("vouchers")
          .select("id")
          .eq("user_id", user.id)
          .eq("merchant_name", merchantName)
          .limit(1);
        return !error && Boolean(data?.length);
      } catch {
        return false;
      }
    })();
    return pending;
  };
}

/**
 * Without coordinates: `?id=` returns a BuyMe catalog's brand count,
 * `?merchant=` returns the known branch list for one chain,
 * `?place=` geocodes a typed city or address in Israel.
 */
export async function GET(request: Request) {
  const deadline = Date.now() + NEARBY_BUDGET_MS;
  const params = new URL(request.url).searchParams;

  const place = params.get("place");
  if (place != null) {
    const hit = await geocodePlace(place, deadline);
    if (!hit) return NextResponse.json({ status: "not_found" });
    return NextResponse.json({ status: "ok", ...hit });
  }

  const merchantName = cleanMerchantName(params.get("merchant"));
  if (merchantName) {
    if (merchantName.length < 2) {
      return NextResponse.json({ error: "missing_target" }, { status: 400 });
    }
    return NextResponse.json(
      await lookupMerchant({
        merchantName,
        origin: null,
        deadline,
        mayPersist: ownsMerchantVoucher(merchantName),
      }),
    );
  }

  const id = params.get("id")?.trim() ?? "";
  if (!isBuyMeCatalogId(id)) {
    return NextResponse.json({ error: "unknown_catalog" }, { status: 400 });
  }
  const catalog = await loadCatalog(id, deadline);
  if (!catalog) {
    return NextResponse.json({
      label: catalogLabel(id),
      brandCount: null,
      places: [],
      status: "catalog_unavailable",
    });
  }
  return NextResponse.json({
    label: catalog.label,
    brandCount: catalog.titles.length,
    places: [],
    status: "ok",
  });
}

/**
 * Nearby businesses. Body: `{ lat, lng, merchantName }` for one merchant,
 * `{ lat, lng, catalogIds: [...] }` for BuyMe catalogs (answer keyed by id),
 * or `{ lat, lng, catalogId }`. Coordinates are used for this request only
 * and are not written to the database or to logs.
 */
export async function POST(request: Request) {
  const deadline = Date.now() + NEARBY_BUDGET_MS;
  let body: {
    lat?: unknown;
    lng?: unknown;
    catalogId?: unknown;
    catalogIds?: unknown;
    merchantName?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const lat = finiteCoord(body.lat, -90, 90);
  const lng = finiteCoord(body.lng, -180, 180);
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "invalid_location" }, { status: 400 });
  }
  const origin = { lat, lng };

  if (Array.isArray(body.catalogIds)) {
    const ids = [...new Set(body.catalogIds.filter((id): id is string => typeof id === "string"))]
      .map((id) => id.trim())
      .slice(0, MAX_CATALOGS);
    if (!ids.length || !ids.every(isBuyMeCatalogId)) {
      return NextResponse.json({ error: "unknown_catalog" }, { status: 400 });
    }
    const catalogs = await lookupCatalogs(ids, origin, deadline);
    after(() => refreshStaleCatalogs(ids));
    return NextResponse.json({ catalogs });
  }

  const catalogId = typeof body.catalogId === "string" ? body.catalogId.trim() : "";
  if (catalogId) {
    if (!isBuyMeCatalogId(catalogId)) {
      return NextResponse.json({ error: "unknown_catalog" }, { status: 400 });
    }
    const results = await lookupCatalogs([catalogId], origin, deadline);
    after(() => refreshStaleCatalogs([catalogId]));
    return NextResponse.json(results[catalogId]);
  }

  const merchantName = cleanMerchantName(body.merchantName);
  if (merchantName.length < 2) {
    return NextResponse.json({ error: "missing_target" }, { status: 400 });
  }
  return NextResponse.json(
    await lookupMerchant({
      merchantName,
      origin,
      deadline,
      mayPersist: ownsMerchantVoucher(merchantName),
    }),
  );
}
