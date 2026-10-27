/** Public BuyMe money-card catalogs (`/brands/{id}/options`). */
export const BUYME_CATALOGS = [
  { id: "13438757", label: "BUYME ALL", pattern: /buyme\s*all/i },
  { id: "17573460", label: "BUYME FOODY", pattern: /buyme\s*foody/i },
  { id: "7565407", label: "BUYME STYLE", pattern: /buyme\s*style/i },
  { id: "17574075", label: "BUYME TOGETHER", pattern: /buyme\s*together/i },
] as const;

export type BuyMeCatalog = (typeof BUYME_CATALOGS)[number];

const CATALOG_IDS = new Set<string>(BUYME_CATALOGS.map((item) => item.id));

export function isBuyMeCatalogId(id: string): boolean {
  return CATALOG_IDS.has(id);
}

export function catalogForText(text: string): BuyMeCatalog | null {
  for (const catalog of BUYME_CATALOGS) {
    if (catalog.pattern.test(text)) return catalog;
  }
  return null;
}

export function catalogForVoucher(voucher: {
  merchantName: string;
  usageTerms?: string | null;
  extractionRaw?: Record<string, unknown> | null;
}): BuyMeCatalog | null {
  const raw = voucher.extractionRaw;
  const supplier =
    raw && typeof raw.supplierName === "string" ? raw.supplierName : "";
  return catalogForText(
    `${voucher.merchantName} ${supplier} ${voucher.usageTerms ?? ""}`,
  );
}

export type CatalogSummary = {
  id: string;
  label: string;
  titles: string[];
};

/** Keep only brand titles from a BuyMe `/options` payload. */
export function slimCatalog(id: string, data: unknown): CatalogSummary | null {
  if (!data || typeof data !== "object") return null;
  const record = data as {
    supplier?: { id?: unknown; name?: unknown };
    brands?: unknown;
  };
  const supplierId = record.supplier?.id;
  if (String(supplierId ?? "") !== id) return null;
  if (!Array.isArray(record.brands)) return null;
  const titles: string[] = [];
  const seen = new Set<string>();
  for (const brand of record.brands) {
    if (!brand || typeof brand !== "object") continue;
    const title = (brand as { title?: unknown }).title;
    if (typeof title !== "string") continue;
    const trimmed = title.trim();
    if (trimmed.length < 2 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    titles.push(trimmed);
  }
  const fallback = BUYME_CATALOGS.find((item) => item.id === id)?.label ?? "BuyMe";
  const name =
    typeof record.supplier?.name === "string" && record.supplier.name.trim()
      ? record.supplier.name.trim()
      : fallback;
  return { id, label: name, titles };
}

export type GeoPlace = {
  name: string;
  names: string[];
  /** Name, brand and operator values, for exact chain matching. */
  chainNames: string[];
  address: string | null;
  lat: number;
  lng: number;
};

export type NearbyPlace = {
  name: string;
  address: string | null;
  distanceKm: number;
  brand: string | null;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״\-–—.,()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BRAND_STOPWORDS = new Set([
  "רשת",
  "מסעדת",
  "מסעדות",
  "מסעדה",
  "סניפים",
  "נבחרים",
  "נבחרות",
  "ברשת",
  "סניף",
  "של",
]);

/** A lone category word must not match every café or hotel. */
const GENERIC_TOKENS = new Set([
  "קפה",
  "cafe",
  "coffee",
  "bar",
  "food",
  "restaurant",
  "hotel",
  "מלון",
]);

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((part) => part.length >= 2 && !BRAND_STOPWORDS.has(part));
}

/**
 * Match a catalog brand to a place when every meaningful word of the brand
 * appears in the place name. "רשת לנדוור" matches "לנדוור". "Greg" does not
 * match "MamaGreg", and "קפה קפה" does not match "קפה שרגא".
 */
export function brandMatchesPlace(brand: string, placeNames: string[]): boolean {
  const prepared = prepareBrand(brand, 0);
  if (!prepared) return false;
  return placeNames.some((placeName) => preparedBrandMatches(prepared, preparePlaceName(placeName)));
}

type PreparedBrand = {
  title: string;
  order: number;
  norm: string;
  tokens: string[];
  genericOnly: boolean;
  phrase: string;
  rawTokenCount: number;
};

type PreparedPlaceName = { norm: string; tokens: Set<string> };

function prepareBrand(title: string, order: number): PreparedBrand | null {
  const norm = normalize(title);
  if (norm.length < 3) return null;
  const rawTokens = tokens(title);
  const unique = [...new Set(rawTokens)];
  if (!unique.length) return null;
  return {
    title,
    order,
    norm,
    tokens: unique,
    genericOnly: unique.every((token) => GENERIC_TOKENS.has(token)),
    phrase: rawTokens.join(" "),
    rawTokenCount: rawTokens.length,
  };
}

function preparePlaceName(placeName: string): PreparedPlaceName {
  return { norm: normalize(placeName), tokens: new Set(tokens(placeName)) };
}

function preparedBrandMatches(brand: PreparedBrand, place: PreparedPlaceName): boolean {
  if (!place.norm) return false;
  if (brand.norm === place.norm) return true;
  if (brand.genericOnly) {
    return brand.rawTokenCount >= 2 && place.norm.includes(brand.phrase);
  }
  return brand.tokens.every((token) => place.tokens.has(token));
}

/**
 * Same rule as `brandMatchesPlace`, indexed by each brand's first word: a
 * 1,300-title catalog against 2,000 nearby places must not compare every pair.
 */
function catalogMatcher(titles: string[]): (placeNames: string[]) => string | null {
  const byNorm = new Map<string, PreparedBrand>();
  const byToken = new Map<string, PreparedBrand[]>();
  const generic: PreparedBrand[] = [];
  titles.forEach((title, order) => {
    const brand = prepareBrand(title, order);
    if (!brand) return;
    if (!byNorm.has(brand.norm)) byNorm.set(brand.norm, brand);
    if (brand.genericOnly) {
      generic.push(brand);
      return;
    }
    const bucket = byToken.get(brand.tokens[0]!) ?? [];
    bucket.push(brand);
    byToken.set(brand.tokens[0]!, bucket);
  });
  return (placeNames) => {
    let best: PreparedBrand | null = null;
    const consider = (brand: PreparedBrand | undefined, place: PreparedPlaceName) => {
      if (!brand || (best && best.order <= brand.order)) return;
      if (preparedBrandMatches(brand, place)) best = brand;
    };
    for (const placeName of placeNames) {
      const place = preparePlaceName(placeName);
      if (!place.norm) continue;
      consider(byNorm.get(place.norm), place);
      for (const token of place.tokens) {
        for (const brand of byToken.get(token) ?? []) consider(brand, place);
      }
      for (const brand of generic) consider(brand, place);
    }
    return (best as PreparedBrand | null)?.title ?? null;
  };
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function addressFromTags(tags: Record<string, string>): string | null {
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const city = tags["addr:city"];
  const line = [street, number].filter(Boolean).join(" ");
  const full = [line, city].filter(Boolean).join(", ");
  return full || null;
}

/** Tag keys an exact chain query matches on. */
export const CHAIN_NAME_KEYS = [
  "name",
  "name:he",
  "name:en",
  "brand",
  "brand:he",
  "brand:en",
  "operator",
  "operator:he",
  "operator:en",
] as const;

const BUSINESS_KEYS = ["shop", "craft", "office", "tourism", "leisure", "healthcare"];

const NON_BUSINESS_AMENITIES = new Set([
  "parking",
  "parking_entrance",
  "parking_space",
  "bicycle_parking",
  "motorcycle_parking",
  "bus_station",
  "taxi",
  "toilets",
  "bench",
  "shelter",
  "waste_basket",
  "waste_disposal",
  "recycling",
  "drinking_water",
  "fountain",
  "telephone",
  "post_box",
  "charging_station",
  "car_sharing",
  "bicycle_rental",
  "townhall",
  "loading_dock",
  "clock",
]);

const NON_BUSINESS_KEYS = [
  "place",
  "boundary",
  "highway",
  "public_transport",
  "railway",
  "landuse",
  "natural",
  "waterway",
  "aeroway",
  "route",
  "admin_level",
];

/**
 * Parking lots, bus stops, city and district names share a chain's name on the
 * map ("חניון סינמה סיטי", "יפו-תל אביב") but are not places to spend a voucher.
 */
export function isNonBusinessPlace(tags: Record<string, unknown>): boolean {
  const amenity = typeof tags.amenity === "string" ? tags.amenity : null;
  if (amenity && NON_BUSINESS_AMENITIES.has(amenity)) return true;
  if (amenity || BUSINESS_KEYS.some((key) => typeof tags[key] === "string")) return false;
  return NON_BUSINESS_KEYS.some((key) => typeof tags[key] === "string");
}

/** Places from an Overpass `out center` JSON document. */
export function parseOverpassElements(data: unknown): GeoPlace[] {
  if (!data || typeof data !== "object") return [];
  const elements = (data as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];
  const places: GeoPlace[] = [];
  for (const element of elements) {
    if (!element || typeof element !== "object") continue;
    const row = element as {
      lat?: unknown;
      lon?: unknown;
      center?: { lat?: unknown; lon?: unknown };
      tags?: Record<string, unknown>;
    };
    const lat = asNumber(row.lat) ?? asNumber(row.center?.lat);
    const lng = asNumber(row.lon) ?? asNumber(row.center?.lon);
    if (lat == null || lng == null) continue;
    const tags = row.tags ?? {};
    if (isNonBusinessPlace(tags)) continue;
    const values = (keys: readonly string[]) =>
      keys
        .map((key) => tags[key])
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim());
    const names = values(["name", "name:he", "name:en", "brand", "brand:he"]);
    if (!names.length) continue;
    const tagStrings: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (typeof value === "string") tagStrings[key] = value;
    }
    const hebrewName = typeof tags["name:he"] === "string" ? tags["name:he"].trim() : "";
    places.push({
      name: hebrewName || names[0]!,
      names,
      chainNames: values(CHAIN_NAME_KEYS),
      address: addressFromTags(tagStrings),
      lat,
      lng,
    });
  }
  return places;
}

/**
 * A 200 with `remark: runtime error` and no elements is a failure, not
 * "no stores nearby". An empty `elements` array is a real empty answer.
 */
export function overpassPlacesOrFailure(data: unknown): GeoPlace[] | null {
  if (!data || typeof data !== "object") return null;
  const record = data as { remark?: unknown; elements?: unknown };
  const places = parseOverpassElements(data);
  if (places.length) return places;
  if (typeof record.remark === "string" && /error|timeout|runtime/i.test(record.remark)) {
    return null;
  }
  if (!Array.isArray(record.elements)) return null;
  return places;
}

export function matchCatalogPlaces(
  titles: string[],
  places: Array<GeoPlace & { distanceKm: number }>,
  limit = 12,
): NearbyPlace[] {
  const matches: NearbyPlace[] = [];
  const kept: Array<{ norm: string; lat: number; lng: number }> = [];
  const brandFor = catalogMatcher(titles);
  const ordered = [...places].sort((a, b) => a.distanceKm - b.distanceKm);
  for (const place of ordered) {
    const brand = brandFor(place.names);
    if (!brand) continue;
    const norm = normalize(place.name);
    // A shop mapped as both a node and a building outline is one branch.
    const duplicate = kept.some(
      (other) =>
        other.norm === norm &&
        Math.abs(other.lat - place.lat) < 0.003 &&
        Math.abs(other.lng - place.lng) < 0.003,
    );
    if (duplicate) continue;
    kept.push({ norm, lat: place.lat, lng: place.lng });
    matches.push({
      name: place.name,
      address: place.address,
      distanceKm: place.distanceKm,
      brand,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}

/** Clip before escaping so the cut never splits an escape sequence. */
export function overpassRegex(value: string): string {
  const clipped = Array.from(value.replace(/\s+/g, " ").trim())
    .slice(0, 40)
    .join("")
    .trim();
  return clipped.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
}
