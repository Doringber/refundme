import "server-only";

import { haversineKm } from "@/lib/stores/nearby";
import {
  BUYME_CATALOGS,
  matchCatalogPlaces,
  slimCatalog,
  type GeoPlace,
} from "@/lib/stores/lookup";
import { queryOverpass } from "@/lib/stores/overpass";
import { readStoredChainPlaces, saveStoredChainPlaces } from "@/lib/stores/place-store";
import {
  CATALOG_RADII_M,
  MERCHANT_RADII_M,
  WIDEN_MIN_LEFT_MS,
  catalogAreaQuery,
  chainQuery,
  isChainPlace,
  merchantKey,
  merchantOverpassQuery,
  nextMerchantRadius,
  overpassTimeoutSec,
  placeCacheKey,
  placeNamesMerchant,
  rankPlaces,
  toStoredPlace,
  type NearbyPayload,
  type StoredPlace,
} from "@/lib/stores/search";

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const CHAIN_TTL_MS = 6 * 60 * 60 * 1000;
const PLACE_TTL_MS = 30 * 60 * 1000;
const CACHE_LIMIT = 500;
/** Hedge a slow mirror after this; normal answers take 1-4s. */
const HEDGE_MS = 4_000;
const CHAIN_HEDGE_MS = 2_500;
const CATALOG_MATCH_WIDEN_BELOW = 3;
/** Dense areas already return thousands of places within the first radius. */
const CATALOG_WIDEN_MAX_PLACES = 1_500;

type Expiring<T> = { expires: number; value: T };

function boundedCache<T>() {
  const map = new Map<string, Expiring<T>>();
  return {
    get(key: string): T | null {
      const hit = map.get(key);
      if (!hit) return null;
      if (hit.expires <= Date.now()) {
        map.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key: string, value: T, ttlMs: number) {
      if (map.size >= CACHE_LIMIT) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
      map.set(key, { expires: Date.now() + ttlMs, value });
    },
  };
}

type CatalogSummary = { label: string; titles: string[] };
const catalogCache = boundedCache<CatalogSummary>();
const chainCache = boundedCache<StoredPlace[]>();
const resultCache = boundedCache<NearbyPayload>();
const areaCache = boundedCache<GeoPlace[]>();

export type Origin = { lat: number; lng: number };

export function catalogLabel(id: string): string | null {
  return BUYME_CATALOGS.find((item) => item.id === id)?.label ?? null;
}

export async function loadCatalog(id: string, deadline: number): Promise<CatalogSummary | null> {
  const hit = catalogCache.get(id);
  if (hit) return hit;
  const left = deadline - Date.now();
  if (left < 1_000) return null;
  try {
    const response = await fetch(`https://buyme.co.il/brands/${id}/options`, {
      headers: {
        accept: "application/json",
        "user-agent": "refundme-catalog",
      },
      signal: AbortSignal.timeout(Math.min(6_000, left)),
      // Payloads run 2-10MB, over the Next data cache limit; catalogCache holds the slim summary.
      cache: "no-store",
    });
    if (!response.ok) return null;
    const summary = slimCatalog(id, await response.json());
    if (!summary) return null;
    const value = { label: summary.label, titles: summary.titles };
    catalogCache.set(id, value, CATALOG_TTL_MS);
    return value;
  } catch {
    return null;
  }
}

function located(places: GeoPlace[], origin: Origin) {
  return places.map((place) => ({
    ...place,
    distanceKm: haversineKm(origin.lat, origin.lng, place.lat, place.lng),
  }));
}

async function areaPlaces(
  origin: Origin,
  radius: number,
  deadline: number,
): Promise<GeoPlace[] | null> {
  const key = placeCacheKey(`area:${radius}`, origin.lat, origin.lng);
  const hit = areaCache.get(key);
  if (hit) return hit;
  const answer = await queryOverpass(
    catalogAreaQuery(origin.lat, origin.lng, radius, overpassTimeoutSec(deadline)),
    { deadline, hedgeMs: HEDGE_MS },
  );
  if (!answer) return null;
  if (answer.complete) areaCache.set(key, answer.places, PLACE_TTL_MS);
  return answer.places;
}

/**
 * Businesses near `origin` that accept each BuyMe catalog, nearest first.
 * All catalogs share one map query so a page with two cards costs one slot
 * on the rate-limited Overpass mirrors.
 */
export async function lookupCatalogs(
  ids: string[],
  origin: Origin,
  deadline: number,
): Promise<Record<string, NearbyPayload>> {
  const results: Record<string, NearbyPayload> = {};
  const pending = ids.filter((id) => {
    const hit = resultCache.get(placeCacheKey(`catalog:${id}`, origin.lat, origin.lng));
    if (hit) results[id] = hit;
    return !hit;
  });
  if (!pending.length) return results;

  const [catalogs, firstArea] = await Promise.all([
    Promise.all(pending.map((id) => loadCatalog(id, deadline))),
    areaPlaces(origin, CATALOG_RADII_M[0], deadline),
  ]);

  const match = (catalog: CatalogSummary, places: GeoPlace[]) =>
    matchCatalogPlaces(catalog.titles, located(places, origin));

  let area = firstArea;
  let radius: number = CATALOG_RADII_M[0];
  let matches = pending.map((_, index) =>
    catalogs[index] && area ? match(catalogs[index]!, area) : [],
  );
  const sparse =
    area != null &&
    area.length < CATALOG_WIDEN_MAX_PLACES &&
    matches.some(
      (rows, index) => catalogs[index] && rows.length < CATALOG_MATCH_WIDEN_BELOW,
    );
  if (sparse && deadline - Date.now() >= WIDEN_MIN_LEFT_MS) {
    const wider = await areaPlaces(origin, CATALOG_RADII_M[1], deadline);
    if (wider) {
      area = wider;
      radius = CATALOG_RADII_M[1];
      matches = pending.map((_, index) =>
        catalogs[index] ? match(catalogs[index]!, wider) : [],
      );
    }
  }

  pending.forEach((id, index) => {
    const catalog = catalogs[index];
    let payload: NearbyPayload;
    if (!catalog) {
      payload = {
        label: catalogLabel(id),
        brandCount: null,
        places: [],
        status: "catalog_unavailable",
      };
    } else if (!area) {
      payload = {
        label: catalog.label,
        brandCount: catalog.titles.length,
        places: [],
        status: "places_unavailable",
      };
    } else {
      const rows = matches[index]!;
      payload = {
        label: catalog.label,
        brandCount: catalog.titles.length,
        places: rows,
        status: rows.length ? "ok" : "no_places",
        radiusKm: radius / 1000,
      };
      resultCache.set(placeCacheKey(`catalog:${id}`, origin.lat, origin.lng), payload, PLACE_TTL_MS);
    }
    results[id] = payload;
  });
  return results;
}

async function knownChain(key: string): Promise<StoredPlace[] | null> {
  const hit = chainCache.get(key);
  if (hit) return hit;
  const stored = await readStoredChainPlaces(key);
  if (stored) chainCache.set(key, stored, CHAIN_TTL_MS);
  return stored;
}

function rememberChain(
  key: string,
  merchantName: string,
  places: StoredPlace[],
  mayPersist: () => Promise<boolean>,
): Promise<void> {
  chainCache.set(key, places, CHAIN_TTL_MS);
  if (!places.length) return Promise.resolve();
  return mayPersist().then((allowed) =>
    allowed ? saveStoredChainPlaces({ key, merchantName, places }) : undefined,
  );
}

/** Optional fallback when the open map has nothing for a single shop name. */
async function googlePlaces(
  origin: Origin,
  text: string,
  deadline: number,
): Promise<StoredPlace[] | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const left = deadline - Date.now();
  if (!key || left < 1_500) return null;
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
        "x-goog-fieldmask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: text,
        maxResultCount: 8,
        languageCode: "he",
        locationBias: {
          circle: {
            center: { latitude: origin.lat, longitude: origin.lng },
            radius: 20_000,
          },
        },
      }),
      signal: AbortSignal.timeout(Math.min(4_000, left)),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      places?: Array<{
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>;
    };
    const places: StoredPlace[] = [];
    for (const place of json.places ?? []) {
      const name = place.displayName?.text?.trim();
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (!name || lat == null || lng == null) continue;
      places.push({ name, address: place.formattedAddress ?? null, lat, lng });
    }
    return places;
  } catch {
    return null;
  }
}

/**
 * Branches of one merchant. With `origin`: nearest first, widening from 6km
 * to 20km and 40km while nothing is found and time is left; branches tagged
 * with the exact chain name come from a country-wide query, so a sparse chain
 * still shows its nearest branch. Without `origin`: the known branch list.
 */
export async function lookupMerchant(input: {
  merchantName: string;
  origin: Origin | null;
  deadline: number;
  mayPersist: () => Promise<boolean>;
}): Promise<NearbyPayload> {
  const { merchantName, origin, deadline } = input;
  const key = merchantKey(merchantName);
  const cacheKey = origin
    ? placeCacheKey(`merchant:${key}`, origin.lat, origin.lng)
    : `merchant:${key}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  let chain = await knownChain(key);
  const saves: Promise<void>[] = [];
  // Overlap the ownership check with the map query; the result is memoized.
  if (!chain) void input.mayPersist();

  if (!origin) {
    if (!chain) {
      const answer = await queryOverpass(
        chainQuery(merchantName, overpassTimeoutSec(deadline)),
        { deadline, hedgeMs: CHAIN_HEDGE_MS },
      );
      if (answer) {
        chain = answer.places.filter((place) => isChainPlace(place, merchantName)).map(toStoredPlace);
        if (answer.complete) saves.push(rememberChain(key, merchantName, chain, input.mayPersist));
      }
    }
    await Promise.all(saves);
    const payload: NearbyPayload = chain
      ? {
          label: merchantName,
          brandCount: null,
          places: rankPlaces(chain, null, { brand: merchantName, limit: 12 }),
          status: chain.length ? "ok" : "no_places",
        }
      : { label: merchantName, brandCount: null, places: [], status: "places_unavailable" };
    if (payload.status !== "places_unavailable") resultCache.set(cacheKey, payload, PLACE_TTL_MS);
    return payload;
  }

  const found: StoredPlace[] = chain ? [...chain] : [];
  let searched = 0;
  let failed = false;
  let radius: number | null = MERCHANT_RADII_M[0];
  while (radius != null) {
    const answer = await queryOverpass(
      merchantOverpassQuery(origin.lat, origin.lng, merchantName, {
        radius,
        withChain: chain == null,
        timeoutSec: overpassTimeoutSec(deadline),
      }),
      { deadline, hedgeMs: HEDGE_MS },
    );
    if (!answer) {
      failed = true;
      break;
    }
    if (chain == null) {
      const chainPlaces = answer.places
        .filter((place) => isChainPlace(place, merchantName))
        .map(toStoredPlace);
      found.push(...chainPlaces);
      if (answer.complete) {
        chain = chainPlaces;
        saves.push(rememberChain(key, merchantName, chainPlaces, input.mayPersist));
      }
    }
    found.push(
      ...answer.places
        .filter((place) => placeNamesMerchant(place, merchantName))
        .map(toStoredPlace),
    );
    if (answer.complete) searched = radius;
    const nearest = rankPlaces(found, origin, { limit: 1, maxKm: Infinity })[0];
    radius = answer.complete
      ? nextMerchantRadius({
          searched,
          nearestKm: nearest?.distanceKm ?? null,
          leftMs: deadline - Date.now(),
        })
      : null;
  }
  await Promise.all(saves);

  let places = rankPlaces(found, origin, { brand: merchantName });
  if (!places.length) {
    const google = await googlePlaces(origin, merchantName, deadline);
    if (google?.length) {
      places = rankPlaces(google, origin, { brand: merchantName });
      failed = false;
    }
  }
  const payload: NearbyPayload = {
    label: merchantName,
    brandCount: null,
    places,
    status: places.length ? "ok" : failed ? "places_unavailable" : "no_places",
    radiusKm: searched ? searched / 1000 : null,
  };
  if (payload.status !== "places_unavailable") resultCache.set(cacheKey, payload, PLACE_TTL_MS);
  return payload;
}

type GeocodeHit = { lat: number; lng: number; label: string };
const geocodeCache = boundedCache<{ hit: GeocodeHit | null }>();
let lastGeocodeAt = 0;

/**
 * A typed city or address in Israel, for searching near it without GPS.
 * Nominatim policy: identify the app, at most one request per second, and no
 * search-as-you-type (the client calls this on an explicit button only).
 */
export async function geocodePlace(
  text: string,
  deadline: number,
): Promise<GeocodeHit | null> {
  const query = text.replace(/\s+/g, " ").trim().slice(0, 120);
  if (query.length < 2) return null;
  const key = query.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached.hit;
  const wait = lastGeocodeAt + 1_000 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastGeocodeAt = Date.now();
  const left = deadline - Date.now();
  if (left < 800) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "il");
  url.searchParams.set("accept-language", "he");
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "refundme/1.0 (+https://justrefundme.netlify.app)",
        referer: "https://justrefundme.netlify.app/",
      },
      signal: AbortSignal.timeout(Math.min(4_000, left)),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    const first = rows[0];
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    const value =
      first && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng, label: (first.display_name ?? query).split(",").slice(0, 2).join(",").trim() }
        : null;
    geocodeCache.set(key, { hit: value }, value ? CATALOG_TTL_MS : PLACE_TTL_MS);
    return value;
  } catch {
    return null;
  }
}
