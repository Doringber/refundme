import { haversineKm } from "@/lib/stores/nearby";
import { CHAIN_NAME_KEYS, overpassRegex, type GeoPlace } from "@/lib/stores/lookup";

/**
 * French mirror answered tag-scoped queries in a few seconds.
 * The German mirror often answers 502 at once and Kumi often hangs, so a
 * slow first attempt is hedged instead of waiting for it to time out.
 */
export const OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

/**
 * Netlify drops a synchronous function at 10s and returns an HTML error page.
 * Every POST must answer JSON before that, including the BuyMe catalog fetch.
 */
export const NEARBY_BUDGET_MS = 8_000;
/** Below this, a new Overpass attempt cannot finish and only adds load. */
export const MIN_ATTEMPT_MS = 1_200;
/** Single-merchant search widens through these radii while time is left. */
export const MERCHANT_RADII_M = [6_000, 20_000, 40_000] as const;
/** A widening step is started only with this much budget left. */
export const WIDEN_MIN_LEFT_MS = 3_500;
/** Branches farther than this are not shown as "nearby". */
export const MAX_PLACE_KM = 50;
export const CATALOG_RADII_M = [3_500, 10_000] as const;

/** Israel, Gaza and the West Bank, for coordinate-free chain queries. */
const ISRAEL_BBOX = "(29.45,34.2,33.35,35.9)";

/**
 * Spellings of the same chain. Different chains stay apart: a Cinema City
 * card is not accepted at Yes Planet, so they are not aliases.
 */
const ALIAS_GROUPS: string[][] = [
  ["FOX", "פוקס", "Fox"],
  ["סופר-פארם", "סופר פארם", "Super-Pharm", "Superpharm"],
  ["שופרסל", "Shufersal"],
  ["זארה", "Zara"],
  ["איקאה", "IKEA", "Ikea"],
  ["רמי לוי", "Rami Levy"],
  ["יוחננוף", "Yochananof"],
  ["מקס סטוק", "Max Stock"],
  ["סינמה סיטי", "Cinema City"],
  ["יס פלאנט", "Yes Planet"],
  ["קסטרו", "Castro"],
  ["רנואר", "Renuar"],
  ["גולף", "Golf"],
  ["סטימצקי", "Steimatzky"],
  ["צומת ספרים", "Tzomet Sfarim"],
  ["הום סנטר", "Home Center"],
  ["אייס", "ACE"],
  ["המשביר לצרכן", "HaMashbir"],
];

const HEBREW = /[\u0590-\u05ff]/;

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
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
      return containsWords(folded, candidate) || containsWords(candidate, folded);
    }),
  );
  const unique = new Set<string>([trimmed]);
  for (const alias of group ?? []) unique.add(alias);
  return [...unique].slice(0, 6);
}

export function merchantKey(name: string): string {
  return fold(name).slice(0, 80);
}

function around(lat: number, lng: number, radius: number): string {
  return `(around:${radius},${lat},${lng})`;
}

function exactStatements(name: string, box: string): string[] {
  const parts: string[] = [];
  for (const alias of merchantAliases(name)) {
    const exact = escapeExact(alias);
    for (const key of CHAIN_NAME_KEYS) parts.push(`nwr["${key}"="${exact}"]${box};`);
  }
  return parts;
}

/**
 * Every branch in Israel whose name, brand or operator is exactly the chain.
 * Tag-value lookups use the Overpass index and answer in under a second, so
 * this works for sparse chains (a cinema 40km away) and needs no coordinates.
 */
export function chainQuery(name: string, timeoutSec = 6): string {
  return `[out:json][timeout:${timeoutSec}];(${exactStatements(name, ISRAEL_BBOX).join("")});out tags center 600;`;
}

/**
 * Each statement rescans the radius, and `,i` is slower, so wider steps use
 * two statements and Hebrew patterns skip `,i` (Hebrew has no case).
 * Measured on the French mirror: 2 statements at 20km 1.6-2.3s, 9 statements 5-8s.
 */
function scopedStatements(lat: number, lng: number, name: string, radius: number): string[] {
  const box = around(lat, lng, radius);
  const wide = radius > MERCHANT_RADII_M[0];
  const aliases = merchantAliases(name);
  // One Hebrew and one Latin token. An alternation (שופרסל|Shufersal) made Overpass time out.
  const hebrew = HEBREW.test(name) ? name : aliases.find((alias) => HEBREW.test(alias));
  const latin = HEBREW.test(name) ? null : name;
  const parts: string[] = [];
  if (hebrew) {
    const pattern = overpassRegex(hebrew);
    parts.push(`nwr["shop"]["name"~"${pattern}"]${box};`, `nwr["amenity"]["name"~"${pattern}"]${box};`);
    if (!wide) parts.push(`nwr["leisure"]["name"~"${pattern}"]${box};`);
  }
  if (latin && (!wide || !hebrew)) {
    const pattern = overpassRegex(latin);
    parts.push(
      `nwr["shop"]["name"~"${pattern}",i]${box};`,
      `nwr["amenity"]["name"~"${pattern}",i]${box};`,
    );
  }
  return parts;
}

/**
 * Names that contain the chain ("סינמה סיטי גלילות"), only on shops, amenities
 * and leisure near the user. An unscoped `name~` regex scans the whole
 * database and times out on every public mirror.
 *
 * One request per lookup: Overpass mirrors throttle by client IP, so the
 * country-wide chain query rides along (`withChain`) when it is not cached.
 */
export function merchantOverpassQuery(
  lat: number,
  lng: number,
  name: string,
  options: { radius?: number; withChain?: boolean; timeoutSec?: number } = {},
): string {
  const radius = options.radius ?? MERCHANT_RADII_M[0];
  const timeoutSec = options.timeoutSec ?? 8;
  const parts = scopedStatements(lat, lng, name, radius);
  if (options.withChain) parts.push(...exactStatements(name, ISRAEL_BBOX));
  return `[out:json][timeout:${timeoutSec}];(${parts.join("")});out tags center 600;`;
}

/**
 * Shops and cafés near the user, for matching a BuyMe catalog by brand title.
 * No output limit: Overpass returns elements by id, so a cap drops near places.
 */
export function catalogAreaQuery(
  lat: number,
  lng: number,
  radius: number = CATALOG_RADII_M[0],
  timeoutSec = 8,
): string {
  const box = around(lat, lng, radius);
  return `[out:json][timeout:${timeoutSec}];(nwr["name"]["shop"]${box};nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|ice_cream|food_court|cinema|theatre)$"]${box};nwr["name"]["tourism"~"^(hotel|guest_house)$"]${box};nwr["name"]["leisure"~"^(fitness_centre|sports_centre|spa|amusement_arcade|bowling_alley|escape_game)$"]${box};);out tags center 6000;`;
}

/** Overpass seconds for a query that must end before `deadline`. */
export function overpassTimeoutSec(deadline: number, now = Date.now()): number {
  return Math.max(1, Math.min(8, Math.floor((deadline - now - 300) / 1000)));
}

export function placeCacheKey(
  target: string,
  lat: number,
  lng: number,
): string {
  return `${target}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
}

/** True when a place carries the chain name exactly on a name/brand/operator tag. */
export function isChainPlace(place: GeoPlace, name: string): boolean {
  const aliases = new Set(merchantAliases(name).map(fold));
  return place.chainNames.some((value) => aliases.has(fold(value)));
}

function foldWords(value: string): string {
  return ` ${value
    .toLowerCase()
    .replace(/["'׳״\-–—.,()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** The partial-name regex also hits "Foxtrot" for FOX; keep whole-word matches. */
export function placeNamesMerchant(place: GeoPlace, merchantName: string): boolean {
  const aliases = merchantAliases(merchantName).map((alias) => foldWords(alias).trim());
  const values = [...place.names, ...place.chainNames].map(foldWords);
  return values.some((value) => aliases.some((alias) => alias && value.includes(` ${alias} `)));
}

export type StoredPlace = {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
};

export function toStoredPlace(place: GeoPlace): StoredPlace {
  return { name: place.name, address: place.address, lat: place.lat, lng: place.lng };
}

export type NearbyPlaceRow = {
  name: string;
  address: string | null;
  distanceKm: number | null;
  brand?: string | null;
  /** Present only when the caller asked for coordinates (Apple Wallet). */
  lat?: number;
  lng?: number;
};

/**
 * Nearest first, one row per branch. A cinema is often both a node and a
 * building outline with the same name a few metres apart.
 */
export function rankPlaces(
  places: StoredPlace[],
  origin: { lat: number; lng: number } | null,
  options: {
    brand?: string | null;
    maxKm?: number;
    limit?: number;
    coordinates?: boolean;
  } = {},
): NearbyPlaceRow[] {
  const maxKm = options.maxKm ?? MAX_PLACE_KM;
  const limit = options.limit ?? 8;
  const rows = places.map((place) => ({
    place,
    distanceKm: origin ? haversineKm(origin.lat, origin.lng, place.lat, place.lng) : null,
  }));
  const ordered = rows
    .filter((row) => row.distanceKm == null || row.distanceKm <= maxKm)
    .sort((a, b) =>
      a.distanceKm == null || b.distanceKm == null
        ? a.place.name.localeCompare(b.place.name, "he")
        : a.distanceKm - b.distanceKm,
    );
  const kept: typeof ordered = [];
  for (const row of ordered) {
    const duplicate = kept.some(
      (other) =>
        fold(other.place.name) === fold(row.place.name) &&
        haversineKm(other.place.lat, other.place.lng, row.place.lat, row.place.lng) < 0.4,
    );
    if (duplicate) continue;
    kept.push(row);
    if (kept.length >= limit) break;
  }
  return kept.map(({ place, distanceKm }) => ({
    name: place.name,
    address: place.address,
    distanceKm,
    brand: options.brand ?? null,
    ...(options.coordinates ? { lat: place.lat, lng: place.lng } : {}),
  }));
}

/**
 * Next radius to try, or null. Widening stops once a branch is within the
 * radius already searched, or when the remaining budget cannot fit a query.
 */
export function nextMerchantRadius(input: {
  searched: number;
  nearestKm: number | null;
  leftMs: number;
}): number | null {
  if (input.nearestKm != null && input.nearestKm * 1000 <= input.searched) return null;
  if (input.leftMs < WIDEN_MIN_LEFT_MS) return null;
  return MERCHANT_RADII_M.find((radius) => radius > input.searched) ?? null;
}

export type NearbyStatus =
  | "ok"
  | "no_places"
  | "catalog_unavailable"
  | "places_unavailable";

export type NearbyPayload = {
  label: string | null;
  brandCount: number | null;
  places: NearbyPlaceRow[];
  status: NearbyStatus;
  /** Largest radius fully searched around the user, in km. */
  radiusKm?: number | null;
};

const STATUSES = new Set<NearbyStatus>([
  "ok",
  "no_places",
  "catalog_unavailable",
  "places_unavailable",
]);

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
    radiusKm?: unknown;
  };
  const status: NearbyStatus = STATUSES.has(record.status as NearbyStatus)
    ? (record.status as NearbyStatus)
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
        if (typeof row.name !== "string") return [];
        const distanceKm =
          typeof row.distanceKm === "number" && Number.isFinite(row.distanceKm)
            ? row.distanceKm
            : null;
        return [
          {
            name: row.name,
            address: typeof row.address === "string" ? row.address : null,
            distanceKm,
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
    radiusKm: typeof record.radiusKm === "number" ? record.radiusKm : null,
  };
}
