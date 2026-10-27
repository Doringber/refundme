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

/**
 * One brand inside a BuyMe money card, taken from
 * `GET https://buyme.co.il/brands/{cardId}/options` (the same document as
 * `GET https://buyme.co.il/siteapi/brands/{cardId}`).
 * BuyMe does not publish branch coordinates. `address` is a street only when
 * the card document itself has one (not a store-locator URL, not an office
 * pulled from a second request).
 */
export type CatalogBrand = {
  title: string;
  aliases: string[];
  id?: string;
  nameHe?: string | null;
  nameEn?: string | null;
  logo?: string | null;
  categories?: string[];
  /** True when BuyMe lists the brand only under online redemption. */
  onlineOnly?: boolean;
  address?: string | null;
  regions?: string[];
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
  "איפור",
  "קוסמטיקה",
  "הלבשה",
  "בגדי",
  "ביגוד",
  "תחתון",
  "תחתונה",
  "מן",
  "קידס",
  "נשים",
  "גברים",
  "men",
  "women",
  "מרכז",
  "צפון",
  "דרום",
  "תל",
  "אביב",
  "ירושלים",
  "חיפה",
  "הרצליה",
  "נתניה",
  "אשדוד",
  "אשקלון",
  "רמת",
  "פתח",
  "תקווה",
  "עזריאלי",
  "קניון",
  "ארצית",
]);

/** BuyMe's own label for a brand that is redeemed on a website, not in a shop. */
const ONLINE_REGION = "מימוש אונליין";

const LOGO_PREFIX = "https://buyme.co.il/files/";

/** Israeli keyboard: Latin typed as Hebrew, and the reverse. */
const LATIN_TO_HEBREW: Record<string, string> = {
  q: "/", w: "'", e: "ק", r: "ר", t: "א", y: "ט", u: "ו", i: "ן", o: "ם", p: "פ",
  a: "ש", s: "ד", d: "ג", f: "כ", g: "ע", h: "י", j: "ח", k: "ל", l: "ך", ";": "ף",
  z: "ז", x: "ס", c: "ב", v: "ה", b: "נ", n: "מ", m: "צ", ",": "ת", ".": "ץ",
};
const HEBREW_TO_LATIN: Record<string, string> = Object.fromEntries(
  Object.entries(LATIN_TO_HEBREW).map(([latin, hebrew]) => [hebrew, latin]),
);

function keyboardMap(value: string, table: Record<string, string>): string {
  return [...value].map((char) => table[char] ?? char).join("");
}

/** The same letters typed on the other keyboard layout, not a translation. */
function isKeyboardEcho(term: string, title: string): boolean {
  const left = term.replace(/\s+/g, "");
  const right = title.replace(/\s+/g, "");
  if (!left || !right) return false;
  return (
    keyboardMap(left, HEBREW_TO_LATIN) === right ||
    keyboardMap(right, LATIN_TO_HEBREW) === left ||
    keyboardMap(right, HEBREW_TO_LATIN) === left ||
    keyboardMap(left, LATIN_TO_HEBREW) === right
  );
}

function hasHebrew(value: string): boolean {
  return /[\u0590-\u05FF]/.test(value);
}

function hasLatin(value: string): boolean {
  return /[a-z]/i.test(value);
}

/** A house number and a street. Store-locator URLs are not branches. */
export function streetAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 4 || trimmed.length > 140) return null;
  if (/^https?:/i.test(trimmed) || trimmed.includes("www.")) return null;
  if (!/\d/.test(trimmed)) return null;
  if (!hasHebrew(trimmed) && !hasLatin(trimmed)) return null;
  return trimmed;
}

function logoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const file = value.trim();
  if (!/^[\w.-]+\.(?:jpe?g|png|webp)(?:\?[\w.=-]*)?$/i.test(file)) return null;
  return `${LOGO_PREFIX}${file}`;
}

function stringList(value: unknown, key: string, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const name = (item as Record<string, unknown>)[key];
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (trimmed.length < 2 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

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
 * Other spellings of this brand only. A search term is kept when it is the
 * title in the other script, or the title plus a qualifier ("קסטרו מן").
 * Sister brands stuffed into the same list ("allsaints" on STORY, "reebok"
 * beside adidas) are not aliases. Keyboard-layout echoes ("צשב" for MAC) are
 * not aliases. Category words are not aliases.
 */
export function distinctiveAliases(title: string, searchTerms: unknown): string[] {
  const titleNorm = normalize(title);
  const titleTokens = new Set(tokens(title).filter((token) => !noisyAlias(token) && token.length >= 3));
  const seen = new Set<string>([titleNorm]);
  const aliases: string[] = [];
  const hebrewSingles: string[] = [];
  const push = (phrase: string) => {
    if (aliases.length >= MAX_ALIASES) return;
    const prepared = prepareBrand(phrase, 0);
    if (!prepared || prepared.genericOnly || seen.has(prepared.norm)) return;
    if (prepared.tokens.every((token) => noisyAlias(token))) return;
    if (isKeyboardEcho(prepared.norm, titleNorm)) return;
    if (/[&/#]/.test(phrase)) return;
    seen.add(prepared.norm);
    aliases.push(prepared.tokens.join(" "));
  };
  const containsTitle = (term: string, termTokens: string[]) =>
    termTokens.some((token) => titleTokens.has(token)) ||
    [...titleTokens].some((token) => token.length >= 4 && normalize(term).includes(token));

  for (const term of parseSearchTerms(searchTerms)) {
    const norm = normalize(term);
    if (!norm || norm === titleNorm || isKeyboardEcho(norm, titleNorm)) continue;
    const termTokens = tokens(term).filter((token) => !noisyAlias(token) && token.length >= 3);
    if (!termTokens.length) continue;
    if (containsTitle(term, termTokens)) {
      const extras = termTokens.filter((token) => !titleTokens.has(token) && hasHebrew(token));
      const extraLatin = termTokens.filter(
        (token) => hasLatin(token) && !hasHebrew(token) && !titleTokens.has(token),
      );
      // A sister brand in the same phrase ("adidas & reebok") contributes only
      // the first Hebrew word. A city glued on ("פתח תקווה") stays one phrase,
      // so "מרכז" alone cannot match a mall.
      if (extraLatin.length) {
        if (extras[0]) push(extras[0]);
      } else if (extras.length === 1) {
        push(extras[0]!);
      } else if (extras.length > 1 && extras.length <= 3) {
        push(extras.join(" "));
      }
      continue;
    }
    if (termTokens.length === 1 && hasHebrew(termTokens[0]!) && !hasLatin(termTokens[0]!)) {
      hebrewSingles.push(termTokens[0]!);
    }
  }
  // A single standalone Hebrew spelling is the brand name. Two or more are
  // other chains BuyMe copied into the same list.
  if (hebrewSingles.length === 1) push(hebrewSingles[0]!);
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
    const row = brand as {
      id?: unknown;
      title?: unknown;
      searchTerms?: unknown;
      logo?: unknown;
      googleMapAddr?: unknown;
      siteAddress?: unknown;
      supplier_regions?: unknown;
      categories_on_brands?: unknown;
    };
    if (typeof row.title !== "string") continue;
    const trimmed = row.title.trim();
    if (trimmed.length < 2 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const aliases = distinctiveAliases(trimmed, row.searchTerms);
    const regions = stringList(row.supplier_regions, "name", 8);
    const physicalRegions = regions.filter((region) => region !== ONLINE_REGION);
    const address =
      streetAddress(row.googleMapAddr) ?? streetAddress(row.siteAddress);
    const onlineOnly = physicalRegions.length === 0 && regions.includes(ONLINE_REGION);
    const hebrewAlias = aliases.find((alias) => hasHebrew(alias)) ?? null;
    const latinAlias = aliases.find((alias) => hasLatin(alias) && !hasHebrew(alias)) ?? null;
    titles.push(trimmed);
    brands.push({
      id: row.id == null ? undefined : String(row.id),
      title: trimmed,
      aliases,
      nameHe: hasHebrew(trimmed) ? trimmed : hebrewAlias,
      nameEn: hasLatin(trimmed) ? trimmed : latinAlias,
      logo: logoUrl(row.logo),
      categories: stringList(row.categories_on_brands, "name", 4),
      onlineOnly,
      address: onlineOnly ? null : address,
      regions,
    });
  }
  const titlesNorm = new Set(titles.map((title) => normalize(title)));
  for (const brand of brands) {
    brand.aliases = brand.aliases.filter((alias) => {
      const norm = normalize(alias);
      return norm === normalize(brand.title) || !titlesNorm.has(norm);
    });
    if (brand.nameHe && brand.nameHe !== brand.title && titlesNorm.has(normalize(brand.nameHe))) {
      brand.nameHe = brand.aliases.find((alias) => hasHebrew(alias)) ?? null;
    }
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
    if (entry.onlineOnly) return;
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
