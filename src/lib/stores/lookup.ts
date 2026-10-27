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
  const brandNorm = normalize(brand);
  if (brandNorm.length < 3) return false;
  const rawTokens = tokens(brand);
  const brandTokens = [...new Set(rawTokens)];
  if (!brandTokens.length) return false;
  const genericOnly = brandTokens.every((token) => GENERIC_TOKENS.has(token));
  const phrase = rawTokens.join(" ");
  for (const placeName of placeNames) {
    const placeNorm = normalize(placeName);
    if (!placeNorm) continue;
    if (brandNorm === placeNorm) return true;
    if (genericOnly) {
      if (rawTokens.length >= 2 && placeNorm.includes(phrase)) return true;
      continue;
    }
    const placeSet = new Set(tokens(placeName));
    if (brandTokens.every((token) => placeSet.has(token))) return true;
  }
  return false;
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
    const names = ["name", "name:he", "name:en", "brand", "brand:he"]
      .map((key) => tags[key])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());
    if (!names.length) continue;
    const tagStrings: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (typeof value === "string") tagStrings[key] = value;
    }
    places.push({
      name: names[0]!,
      names,
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
  const seen = new Set<string>();
  const ordered = [...places].sort((a, b) => a.distanceKm - b.distanceKm);
  for (const place of ordered) {
    const brand = titles.find((title) => brandMatchesPlace(title, place.names));
    if (!brand) continue;
    const key = `${normalize(place.name)}:${place.distanceKm.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
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
