import { overpassRegex } from "@/lib/stores/lookup";

/**
 * French mirror answered tag-scoped queries in a few seconds.
 * The German and Kumi mirrors often hang on the same query.
 */
export const OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

/** Hard cap so a Netlify function returns JSON before the inactivity timeout. */
export const NEARBY_BUDGET_MS = 12_000;
/** One attempt. A second mirror is used only when the first fails quickly. */
export const OVERPASS_ATTEMPT_MS = 11_000;

const ALIAS_GROUPS: string[][] = [
  ["FOX", "פוקס", "Fox"],
  ["סופר-פארם", "סופר פארם", "Super-Pharm", "Superpharm"],
  ["שופרסל", "Shufersal"],
  ["זארה", "Zara"],
  ["איקאה", "IKEA", "Ikea"],
  ["רמי לוי", "Rami Levy"],
  ["יוחננוף", "Yochananof"],
  ["מקס סטוק", "Max Stock"],
];

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeExact(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Extra spellings so "FOX" also hits the Hebrew name on the map. */
export function merchantAliases(name: string): string[] {
  const trimmed = name.trim();
  if (trimmed.length < 2) return [];
  const folded = fold(trimmed);
  const group = ALIAS_GROUPS.find((aliases) =>
    aliases.some((alias) => {
      const candidate = fold(alias);
      return candidate === folded || folded.includes(candidate) || candidate.includes(folded);
    }),
  );
  const unique = new Set<string>([trimmed]);
  for (const alias of group ?? []) unique.add(alias);
  return [...unique].slice(0, 6);
}

function around(lat: number, lng: number, radius: number): string {
  return `(around:${radius},${lat},${lng})`;
}

/**
 * Exact name/brand match. Overpass can answer this in a couple of seconds.
 * The old unscoped `name~"..."` regex inside 8km timed out every public mirror.
 */
export function exactMerchantQuery(
  lat: number,
  lng: number,
  name: string,
  radius = 6000,
): string {
  const box = around(lat, lng, radius);
  const parts: string[] = [];
  for (const alias of merchantAliases(name)) {
    const exact = escapeExact(alias);
    parts.push(`nwr["name"="${exact}"]${box}`);
    parts.push(`nwr["name:he"="${exact}"]${box}`);
    parts.push(`nwr["brand"="${exact}"]${box}`);
  }
  return `[out:json][timeout:6];(${parts.join(";")};);out center 20;`;
}

/** One query per chain. Hebrew names use a shop filter; Latin names use exact tags. */
export function merchantOverpassQuery(lat: number, lng: number, name: string): string {
  return /[\u0590-\u05ff]/.test(name)
    ? scopedMerchantQuery(lat, lng, name)
    : exactMerchantQuery(lat, lng, name);
}

/** Fuzzy match, but only on shops and food places — not every named object. */
export function scopedMerchantQuery(
  lat: number,
  lng: number,
  name: string,
  radius = 6000,
): string {
  // One token. An alias alternation (שופרסל|Shufersal) made Overpass time out.
  const pattern = overpassRegex(name).slice(0, 40);
  const box = around(lat, lng, radius);
  return `[out:json][timeout:8];(nwr["shop"]["name"~"${pattern}",i]${box};nwr["amenity"]["name"~"${pattern}",i]${box};nwr["shop"]["brand"~"${pattern}",i]${box};nwr["name:he"~"${pattern}"]["shop"]${box};);out center 20;`;
}

/** Shops and cafés near the user, for matching a BuyMe catalog by brand title. */
export function catalogAreaQuery(lat: number, lng: number, radius = 3500): string {
  const box = around(lat, lng, radius);
  return `[out:json][timeout:8];(nwr["name"]["shop"]${box};nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|bar|pharmacy|ice_cream|food_court)$"]${box};nwr["name"]["tourism"~"^(hotel|guest_house)$"]${box};);out center 120;`;
}

export function placeCacheKey(
  target: string,
  lat: number,
  lng: number,
): string {
  return `${target}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
}

export type NearbyStatus =
  | "ok"
  | "no_places"
  | "catalog_unavailable"
  | "places_unavailable";

export type NearbyPayload = {
  label: string | null;
  brandCount: number | null;
  places: Array<{
    name: string;
    address: string | null;
    distanceKm: number;
    brand?: string | null;
  }>;
  status: NearbyStatus;
};

/** Turn a fetch result into a payload. HTML 504s must not throw away other lookups. */
export function parseNearbyPayload(input: {
  contentType: string | null;
  body: unknown;
}): NearbyPayload {
  const empty: NearbyPayload = {
    label: null,
    brandCount: null,
    places: [],
    status: "places_unavailable",
  };
  if (!input.contentType?.toLowerCase().includes("json")) return empty;
  if (!input.body || typeof input.body !== "object") return empty;
  const record = input.body as {
    label?: unknown;
    brandCount?: unknown;
    places?: unknown;
    status?: unknown;
  };
  const status: NearbyStatus =
    record.status === "ok" ||
    record.status === "no_places" ||
    record.status === "catalog_unavailable" ||
    record.status === "places_unavailable"
      ? record.status
      : "places_unavailable";
  const places = Array.isArray(record.places)
    ? record.places.flatMap((place) => {
        if (!place || typeof place !== "object") return [];
        const row = place as {
          name?: unknown;
          address?: unknown;
          distanceKm?: unknown;
          brand?: unknown;
        };
        if (typeof row.name !== "string" || typeof row.distanceKm !== "number") return [];
        return [
          {
            name: row.name,
            address: typeof row.address === "string" ? row.address : null,
            distanceKm: row.distanceKm,
            brand: typeof row.brand === "string" ? row.brand : null,
          },
        ];
      })
    : [];
  return {
    label: typeof record.label === "string" ? record.label : null,
    brandCount: typeof record.brandCount === "number" ? record.brandCount : null,
    places,
    status,
  };
}
