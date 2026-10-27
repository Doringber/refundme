import { NextResponse } from "next/server";
import { haversineKm } from "@/lib/stores/nearby";
import {
  BUYME_CATALOGS,
  isBuyMeCatalogId,
  matchCatalogPlaces,
  merchantQuery,
  parseOverpassElements,
  slimCatalog,
  type GeoPlace,
  type NearbyPlace,
} from "@/lib/stores/lookup";

export const runtime = "nodejs";

const OVERPASS_URLS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

type CachedCatalog = { expires: number; label: string; titles: string[] };
const catalogCache = new Map<string, CachedCatalog>();

type LookupStatus = "ok" | "no_places" | "catalog_unavailable" | "places_unavailable";

function finiteCoord(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

async function loadCatalog(id: string): Promise<CachedCatalog | null> {
  const hit = catalogCache.get(id);
  if (hit && hit.expires > Date.now()) return hit;
  const response = await fetch(`https://buyme.co.il/brands/${id}/options`, {
    headers: {
      accept: "application/json",
      "user-agent": "refundme-catalog",
    },
    signal: AbortSignal.timeout(20_000),
    // Payloads run 2-10MB, over the Next data cache limit; catalogCache holds the slim summary.
    cache: "no-store",
  });
  if (!response.ok) return null;
  const summary = slimCatalog(id, await response.json());
  if (!summary) return null;
  const cached = {
    expires: Date.now() + CATALOG_TTL_MS,
    label: summary.label,
    titles: summary.titles,
  };
  catalogCache.set(id, cached);
  return cached;
}

async function overpass(query: string): Promise<GeoPlace[] | null> {
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "refundme-stores",
          accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(18_000),
        cache: "no-store",
      });
      if (!response.ok) continue;
      return parseOverpassElements(await response.json());
    } catch {
      /* try the next mirror */
    }
  }
  return null;
}

function locate(places: GeoPlace[], lat: number, lng: number) {
  return places.map((place) => ({
    ...place,
    distanceKm: haversineKm(lat, lng, place.lat, place.lng),
  }));
}

function areaQuery(lat: number, lng: number): string {
  const around = `(around:3000,${lat},${lng})`;
  return `[out:json][timeout:20];(nwr["name"]["shop"]${around};nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|bar|pharmacy|ice_cream|food_court)$"]${around};nwr["name"]["tourism"~"^(hotel|guest_house)$"]${around};);out center 150;`;
}

async function googlePlaces(
  lat: number,
  lng: number,
  text: string,
): Promise<NearbyPlace[] | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return null;
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
            center: { latitude: lat, longitude: lng },
            radius: 8000,
          },
        },
      }),
      signal: AbortSignal.timeout(12_000),
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
    const places: NearbyPlace[] = [];
    for (const place of json.places ?? []) {
      const name = place.displayName?.text?.trim();
      const placeLat = place.location?.latitude;
      const placeLng = place.location?.longitude;
      if (!name || placeLat == null || placeLng == null) continue;
      places.push({
        name,
        address: place.formattedAddress ?? null,
        distanceKm: haversineKm(lat, lng, placeLat, placeLng),
        brand: text,
      });
    }
    return places.sort((a, b) => a.distanceKm - b.distanceKm);
  } catch {
    return null;
  }
}

function payload(input: {
  label: string | null;
  brandCount: number | null;
  places: NearbyPlace[];
  status: LookupStatus;
}) {
  return NextResponse.json(input);
}

/** Brand count only. No coordinates. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!isBuyMeCatalogId(id)) {
    return NextResponse.json({ error: "unknown_catalog" }, { status: 400 });
  }
  try {
    const catalog = await loadCatalog(id);
    if (!catalog) {
      return NextResponse.json(
        { label: BUYME_CATALOGS.find((item) => item.id === id)?.label ?? null, brandCount: null, status: "catalog_unavailable" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      label: catalog.label,
      brandCount: catalog.titles.length,
      status: "ok",
    });
  } catch {
    return NextResponse.json({ status: "catalog_unavailable" }, { status: 502 });
  }
}

/**
 * Nearby businesses for one voucher. Coordinates are used for this request
 * only and are not written to the database or to logs.
 */
export async function POST(request: Request) {
  let body: { lat?: unknown; lng?: unknown; catalogId?: unknown; merchantName?: unknown };
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

  const catalogId = typeof body.catalogId === "string" ? body.catalogId.trim() : "";
  const merchantName =
    typeof body.merchantName === "string" ? body.merchantName.trim().slice(0, 80) : "";

  if (catalogId) {
    if (!isBuyMeCatalogId(catalogId)) {
      return NextResponse.json({ error: "unknown_catalog" }, { status: 400 });
    }
    let catalog: CachedCatalog | null = null;
    try {
      catalog = await loadCatalog(catalogId);
    } catch {
      catalog = null;
    }
    if (!catalog) {
      return payload({
        label: BUYME_CATALOGS.find((item) => item.id === catalogId)?.label ?? null,
        brandCount: null,
        places: [],
        status: "catalog_unavailable",
      });
    }
    const places = await overpass(areaQuery(lat, lng));
    if (!places) {
      return payload({
        label: catalog.label,
        brandCount: catalog.titles.length,
        places: [],
        status: "places_unavailable",
      });
    }
    const matched = matchCatalogPlaces(catalog.titles, locate(places, lat, lng));
    return payload({
      label: catalog.label,
      brandCount: catalog.titles.length,
      places: matched,
      status: matched.length ? "ok" : "no_places",
    });
  }

  if (!merchantName || merchantName.length < 2) {
    return NextResponse.json({ error: "missing_target" }, { status: 400 });
  }
  const places = await overpass(merchantQuery(lat, lng, merchantName));
  let nearby: NearbyPlace[] =
    places?.map((place) => ({
      name: place.name,
      address: place.address,
      distanceKm: haversineKm(lat, lng, place.lat, place.lng),
      brand: merchantName,
    })) ?? [];
  nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  if (!nearby.length) {
    const google = await googlePlaces(lat, lng, merchantName);
    if (google?.length) nearby = google;
  }
  if (!places && !nearby.length) {
    return payload({
      label: merchantName,
      brandCount: null,
      places: [],
      status: "places_unavailable",
    });
  }
  return payload({
    label: merchantName,
    brandCount: null,
    places: nearby.slice(0, 8),
    status: nearby.length ? "ok" : "no_places",
  });
}
