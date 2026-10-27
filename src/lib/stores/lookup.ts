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

/** A catalog brand plus the distinctive names BuyMe lists beside the title. */
export type CatalogBrand = {
  title: string;
  aliases: string[];
};

export type CatalogSummary = {
  id: string;
  label: string;
  titles: string[];
  brands: CatalogBrand[];
};

const MAX_ALIASES = 8;

/**
 * Category words BuyMe stuffs into `searchTerms` next to the real name.
 * Matching these would pin every sports shop or café to one brand.
 */
const ALIAS_NOISE = new Set([
  "ספורט",
  "ריצה",
  "כדור",
  "אופנה",
  "כדורגל",
  "אוכל",
  "בגדים",
  "נעליים",
  "מתנה",
  "מתנות",
  "המתנות",
  "האהובות",
  "אהובות",
  "קניות",
  "צעצועים",
  "ילדים",
  "נשים",
  "גברים",
  "בית",
  "ספרים",
  "טיפוח",
  "קוסמטיקה",
  "תכשיטים",
  "שעונים",
  "משקפיים",
  "אלקטרוניקה",
  "מחשבים",
  "קולנוע",
  "הופעות",
  "כרטיסים",
  "שובר",
  "גיפט",
  "פקקים",
  "סמבה",
  "אונליין",
  "משלוח",
  "הנחה",
  "מבצע",
  "אופטיקה",
  "ביגוד",
  "הלבשה",
  "תינוקות",
  "תינוק",
  "צעצוע",
  "משחקים",
  "כושר",
  "יוגה",
  "בריאות",
  "מזון",
  "sport",
  "sports",
  "fashion",
  "shoes",
  "gift",
  "gifts",
  "online",
  "shop",
  "store",
  "kids",
  "baby",
  "home",
  "beauty",
  "sale",
  "style",
  "wear",
  "clothing",
  "samba",
  "football",
  "soccer",
  "running",
  "סופר",
  "פארם",
  "משלוח",
  "משלוחה",
  "משלוחים",
  "משתלה",
  "הום",
  "יודה",
  "ישראל",
  "כלי",
  "טעמים",
  "חומוס",
]);

/** `searchTerms` is either a string array or a JSON string of one. */
export function parseSearchTerms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || !value.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      return parseSearchTerms(JSON.parse(trimmed) as unknown);
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

function noisyAlias(token: string): boolean {
  return (
    token.length < 3 ||
    ALIAS_NOISE.has(token) ||
    GENERIC_TOKENS.has(token) ||
    BRAND_STOPWORDS.has(token)
  );
}

/**
 * Names worth matching on the map. Hebrew terms that stand alone ("אדידס")
 * and siblings that share a search term with the title ("reebok" next to
 * "adidas") are kept. Category keywords and keyboard-smash typos are not.
 */
export function distinctiveAliases(title: string, searchTerms: unknown): string[] {
  const titleTokens = new Set(tokens(title).filter((token) => !noisyAlias(token)));
  const seen = new Set<string>([normalize(title)]);
  const aliases: string[] = [];
  const push = (phrase: string) => {
    if (aliases.length >= MAX_ALIASES) return;
    const prepared = prepareBrand(phrase, 0);
    if (!prepared || prepared.genericOnly || seen.has(prepared.norm)) return;
    if (prepared.tokens.every((token) => noisyAlias(token))) return;
    seen.add(prepared.norm);
    aliases.push(prepared.tokens.join(" "));
  };
  const sharesTitle = (termTokens: string[]) =>
    termTokens.some(
      (token) =>
        titleTokens.has(token) ||
        [...titleTokens].some(
          (titleToken) =>
            titleToken.length >= 4 &&
            token.length >= 4 &&
            (token.includes(titleToken) || titleToken.includes(token)),
        ),
    );

  for (const term of parseSearchTerms(searchTerms)) {
    if (aliases.length >= MAX_ALIASES) break;
    const termTokens = tokens(term);
    if (sharesTitle(termTokens)) {
      for (const token of termTokens) {
        if (titleTokens.has(token) || noisyAlias(token)) continue;
        if (!/[\u0590-\u05FF]/.test(token) && token.length < 4) continue;
        push(token);
      }
      continue;
    }
    const kept = termTokens.filter((token) => !noisyAlias(token));
    if (kept.length === 1 && /[\u0590-\u05FF]/.test(kept[0]!)) push(kept[0]!);
  }
  return aliases;
}

/** Keep brand titles and distinctive aliases from a BuyMe `/options` payload. */
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
  const brands: CatalogBrand[] = [];
  const seen = new Set<string>();
  for (const brand of record.brands) {
    if (!brand || typeof brand !== "object") continue;
    const row = brand as { title?: unknown; searchTerms?: unknown };
    if (typeof row.title !== "string") continue;
    const trimmed = row.title.trim();
    if (trimmed.length < 2 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    titles.push(trimmed);
    brands.push({ title: trimmed, aliases: distinctiveAliases(trimmed, row.searchTerms) });
  }
  const fallback = BUYME_CATALOGS.find((item) => item.id === id)?.label ?? "BuyMe";
  const name =
    typeof record.supplier?.name === "string" && record.supplier.name.trim()
      ? record.supplier.name.trim()
      : fallback;
  return { id, label: name, titles, brands };
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
  /** Title match, or an alias. Shared aliases are weaker than a brand's own name. */
  kind: "title" | "alias";
  /** How many catalog brands carry this exact alias. */
  owners: number;
};

/** One extra word that still means the same chain ("גולף ילדים", "קסטרו הום"). */
const BRANCH_WORDS = new Set([
  "ילדים",
  "ילד",
  "הום",
  "home",
  "kids",
  "kid",
  "קניון",
  "סנטר",
  "סניף",
  "outlet",
  "אאוטלט",
]);

type PreparedPlaceName = { norm: string; tokens: Set<string> };

function prepareBrand(phrase: string, order: number, display = phrase): PreparedBrand | null {
  const norm = normalize(phrase);
  if (norm.length < 3) return null;
  const rawTokens = tokens(phrase);
  const unique = [...new Set(rawTokens)];
  if (!unique.length) return null;
  return {
    title: display,
    order,
    norm,
    tokens: unique,
    genericOnly: unique.every((token) => GENERIC_TOKENS.has(token)),
    phrase: rawTokens.join(" "),
    rawTokenCount: rawTokens.length,
    kind: "title",
    owners: 1,
  };
}

function preparePlaceName(placeName: string): PreparedPlaceName {
  return { norm: normalize(placeName), tokens: new Set(tokens(placeName)) };
}

/** BuyMe writes לאלין and the map writes ללין. Aleph is the only letter folded. */
function foldAleph(token: string): string {
  return token.replace(/א/g, "");
}

function tokenInPlace(token: string, place: PreparedPlaceName): boolean {
  if (place.tokens.has(token)) return true;
  const folded = foldAleph(token);
  if (folded.length < 3 || folded === token) return false;
  for (const other of place.tokens) {
    if (foldAleph(other) === folded) return true;
  }
  return false;
}

function preparedBrandMatches(brand: PreparedBrand, place: PreparedPlaceName): boolean {
  if (!place.norm) return false;
  if (brand.norm === place.norm || foldAleph(brand.norm) === foldAleph(place.norm)) return true;
  if (brand.kind === "alias" && brand.owners > 4) return false;
  if (brand.genericOnly) {
    return brand.rawTokenCount >= 2 && place.norm.includes(brand.phrase);
  }
  if (!brand.tokens.every((token) => tokenInPlace(token, place))) return false;
  if (brand.kind === "alias" && brand.owners > 1) {
    const extra = [...place.tokens].filter((token) => !brand.tokens.includes(token));
    if (extra.length > 1) return false;
    if (extra.some((token) => !BRANCH_WORDS.has(token))) return false;
  }
  return true;
}

function brandScore(brand: PreparedBrand): number {
  // Catalog order picks between two titles. Length picks between two aliases
  // that share a stuffed keyword ("פוקס" on FOX, not on TERMINAL X).
  const aliasLength = brand.kind === "alias" ? 80 - brand.title.length : 0;
  return (
    (brand.kind === "title" ? 1_000 : 0) +
    (brand.owners <= 1 ? 40 : 0) -
    brand.owners +
    aliasLength -
    brand.order / 100
  );
}

/**
 * Same rule as `brandMatchesPlace`, indexed by each name's first word: a
 * 1,300-brand catalog against 2,000 nearby places must not compare every pair.
 * Aliases point back at the brand title ("אדידס" matches places for adidas).
 */
function catalogMatcher(brands: CatalogBrand[]): (placeNames: string[]) => string | null {
  const byNorm = new Map<string, PreparedBrand>();
  const byToken = new Map<string, PreparedBrand[]>();
  const generic: PreparedBrand[] = [];
  const aliasOwners = new Map<string, number>();
  for (const entry of brands) {
    const seen = new Set<string>();
    for (const alias of entry.aliases) {
      const norm = normalize(alias);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      aliasOwners.set(norm, (aliasOwners.get(norm) ?? 0) + 1);
    }
  }
  const remember = (brand: PreparedBrand) => {
    const existing = byNorm.get(brand.norm);
    if (existing && brandScore(existing) >= brandScore(brand)) return;
    byNorm.set(brand.norm, brand);
    if (brand.genericOnly) {
      generic.push(brand);
      return;
    }
    const keys = new Set([brand.tokens[0]!]);
    const folded = foldAleph(brand.tokens[0]!);
    if (folded.length >= 3) keys.add(folded);
    for (const key of keys) {
      const bucket = byToken.get(key) ?? [];
      bucket.push(brand);
      byToken.set(key, bucket);
    }
  };
  brands.forEach((entry, order) => {
    const title = prepareBrand(entry.title, order);
    if (title) remember(title);
    for (const alias of entry.aliases) {
      const prepared = prepareBrand(alias, order, entry.title);
      if (!prepared || prepared.tokens.some((token) => noisyAlias(token))) continue;
      prepared.kind = "alias";
      prepared.owners = aliasOwners.get(prepared.norm) ?? 1;
      remember(prepared);
    }
  });
  return (placeNames) => {
    let best: PreparedBrand | null = null;
    const consider = (brand: PreparedBrand | undefined, place: PreparedPlaceName) => {
      if (!brand || (best && brandScore(best) >= brandScore(brand))) return;
      if (preparedBrandMatches(brand, place)) best = brand;
    };
    for (const placeName of placeNames) {
      const place = preparePlaceName(placeName);
      if (!place.norm) continue;
      consider(byNorm.get(place.norm), place);
      const keys = new Set<string>();
      for (const token of place.tokens) {
        keys.add(token);
        const folded = foldAleph(token);
        if (folded.length >= 3) keys.add(folded);
      }
      for (const token of keys) {
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
  titles: Array<string | CatalogBrand>,
  places: Array<GeoPlace & { distanceKm: number }>,
  limit = 12,
): NearbyPlace[] {
  const matches: NearbyPlace[] = [];
  const kept: Array<{ norm: string; lat: number; lng: number }> = [];
  const brandFor = catalogMatcher(
    titles.map((item) => (typeof item === "string" ? { title: item, aliases: [] } : item)),
  );
  const ordered = [...places].sort((a, b) => a.distanceKm - b.distanceKm);
  for (const place of ordered) {
    const onPrimary = brandFor([place.name]);
    // A shop named רולדין must not become H&M because another tag on the same
    // object says H&M. Secondary names apply only when the main name is generic.
    const properName = tokens(place.name).some(
      (token) => token.length >= 4 && !GENERIC_TOKENS.has(token) && !BRANCH_WORDS.has(token),
    );
    const brand =
      onPrimary ??
      (properName ? null : brandFor(place.names.filter((name) => name !== place.name)));
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
