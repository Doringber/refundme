import "server-only";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { logServerError } from "@/lib/log";
import type { CatalogBrand, CatalogSummary } from "@/lib/stores/lookup";
import { BUYME_CATALOGS } from "@/lib/stores/lookup";
import { getSecretKey } from "@/lib/supabase/secret";

const DB_TIMEOUT_MS = 2_500;
const MAX_BRANDS = 2_500;
const MAX_ALIASES = 8;

function admin(): SupabaseClient | null {
  const key = getSecretKey();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function withTimeout<T>(work: PromiseLike<T>, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(work),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), DB_TIMEOUT_MS)),
  ]);
}

export function asCatalogBrands(value: unknown): CatalogBrand[] | null {
  if (!Array.isArray(value)) return null;
  const brands: CatalogBrand[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      title?: unknown;
      aliases?: unknown;
      id?: unknown;
      nameHe?: unknown;
      nameEn?: unknown;
      logo?: unknown;
      categories?: unknown;
      onlineOnly?: unknown;
      address?: unknown;
      regions?: unknown;
    };
    if (typeof row.title !== "string") continue;
    const title = row.title.trim();
    if (title.length < 2) continue;
    const aliases = Array.isArray(row.aliases)
      ? row.aliases
          .filter((alias): alias is string => typeof alias === "string")
          .map((alias) => alias.trim())
          .filter((alias) => alias.length >= 2)
          .slice(0, MAX_ALIASES)
      : [];
    const texts = (value: unknown, limit: number) =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length >= 2)
            .slice(0, limit)
        : [];
    brands.push({
      title,
      aliases,
      id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : undefined,
      nameHe: typeof row.nameHe === "string" ? row.nameHe : null,
      nameEn: typeof row.nameEn === "string" ? row.nameEn : null,
      logo: typeof row.logo === "string" && row.logo.startsWith("https://buyme.co.il/files/") ? row.logo : null,
      categories: texts(row.categories, 4),
      onlineOnly: row.onlineOnly === true,
      address: typeof row.address === "string" ? row.address : null,
      regions: texts(row.regions, 8),
    });
    if (brands.length >= MAX_BRANDS) break;
  }
  return brands.length ? brands : null;
}

export type StoredCatalog = {
  summary: CatalogSummary;
  fetchedAt: number;
  lastModified: string | null;
};

/**
 * Slim brand list saved by the catalog cron, or null when the table is
 * missing, the server has no secret, or the row is unreadable.
 * A stale row is still returned so a nearby search can answer without
 * downloading the multi-megabyte BuyMe payload.
 */
export async function readStoredCatalog(id: string): Promise<StoredCatalog | null> {
  const db = admin();
  if (!db) return null;
  try {
    const result = await withTimeout(
      db
        .from("buyme_brand_catalogs")
        .select("label,brands,fetched_at,source_last_modified")
        .eq("catalog_id", id)
        .maybeSingle(),
      null,
    );
    if (!result || result.error || !result.data) return null;
    const brands = asCatalogBrands(result.data.brands);
    if (!brands) return null;
    const fetchedAt = Date.parse(String(result.data.fetched_at));
    if (!Number.isFinite(fetchedAt)) return null;
    const known = BUYME_CATALOGS.find((item) => item.id === id);
    const label =
      typeof result.data.label === "string" && result.data.label.trim()
        ? result.data.label.trim()
        : (known?.label ?? "BuyMe");
    return {
      summary: {
        id,
        label,
        titles: brands.map((brand) => brand.title),
        brands,
      },
      fetchedAt,
      lastModified:
        typeof result.data.source_last_modified === "string"
          ? result.data.source_last_modified
          : null,
    };
  } catch {
    return null;
  }
}

export async function saveStoredCatalog(input: {
  summary: CatalogSummary;
  fetchedAt: number;
  lastModified: string | null;
}): Promise<"saved" | "skipped" | "migration_required" | "failed"> {
  const db = admin();
  if (!db) return "skipped";
  try {
    const result = await withTimeout(
      db.from("buyme_brand_catalogs").upsert(
        {
          catalog_id: input.summary.id,
          label: input.summary.label.slice(0, 200),
          brands: input.summary.brands.slice(0, MAX_BRANDS),
          brand_count: input.summary.brands.length,
          source_url: `https://buyme.co.il/brands/${input.summary.id}/options`,
          source_last_modified: input.lastModified,
          fetched_at: new Date(input.fetchedAt).toISOString(),
        },
        { onConflict: "catalog_id" },
      ),
      null,
    );
    if (!result) return "failed";
    if (!result.error) return "saved";
    if (result.error.code === "PGRST205" || result.error.code === "42P01") {
      return "migration_required";
    }
    if (/does not exist|schema cache|Could not find the/i.test(result.error.message)) {
      return "migration_required";
    }
    logServerError("buyme-catalog-cache", result.error.message);
    return "failed";
  } catch (error) {
    logServerError("buyme-catalog-cache", error);
    return "failed";
  }
}
