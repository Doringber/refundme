import "server-only";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { logServerError } from "@/lib/log";
import type { StoredPlace } from "@/lib/stores/search";
import { getSecretKey } from "@/lib/supabase/secret";

/** Stored chain branches are refreshed from the map after this. */
export const STORED_PLACES_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DB_TIMEOUT_MS = 900;
const MAX_STORED = 600;

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

function asStoredPlaces(value: unknown): StoredPlace[] | null {
  if (!Array.isArray(value)) return null;
  const places: StoredPlace[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string") continue;
    if (typeof row.lat !== "number" || typeof row.lng !== "number") continue;
    places.push({
      name: row.name,
      address: typeof row.address === "string" ? row.address : null,
      lat: row.lat,
      lng: row.lng,
    });
  }
  return places;
}

/**
 * Chain branches saved from an earlier coordinate-free map query, or null.
 * Returns null when the table does not exist yet (migration not applied),
 * the server has no secret key, or the row is stale.
 */
export async function readStoredChainPlaces(key: string): Promise<StoredPlace[] | null> {
  const db = admin();
  if (!db) return null;
  try {
    const result = await withTimeout(
      db
        .from("merchant_place_cache")
        .select("places,refreshed_at")
        .eq("merchant_key", key)
        .maybeSingle(),
      null,
    );
    if (!result || result.error || !result.data) return null;
    const refreshed = Date.parse(String(result.data.refreshed_at));
    if (!Number.isFinite(refreshed) || Date.now() - refreshed > STORED_PLACES_TTL_MS) {
      return null;
    }
    return asStoredPlaces(result.data.places);
  } catch {
    return null;
  }
}

/**
 * Save public map branches for a chain. Only places from the country-wide
 * exact-name query are stored, so nothing here depends on where the user is.
 */
export async function saveStoredChainPlaces(input: {
  key: string;
  merchantName: string;
  places: StoredPlace[];
}): Promise<void> {
  const db = admin();
  if (!db || !input.places.length) return;
  try {
    const result = await withTimeout(
      db.from("merchant_place_cache").upsert(
        {
          merchant_key: input.key,
          merchant_name: input.merchantName.slice(0, 80),
          places: input.places.slice(0, MAX_STORED),
          source: "osm",
          refreshed_at: new Date().toISOString(),
        },
        { onConflict: "merchant_key" },
      ),
      null,
    );
    if (result?.error && result.error.code !== "PGRST205" && result.error.code !== "42P01") {
      logServerError("stores-place-cache", result.error.message);
    }
  } catch (error) {
    logServerError("stores-place-cache", error);
  }
}
