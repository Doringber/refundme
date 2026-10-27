/** Where the stores page searches from. Kept on this device only. */
export type SearchOrigin = {
  lat: number;
  lng: number;
  /** "device" = GPS fix; "place" = a city or address the user typed. */
  source: "device" | "place";
  label: string | null;
};

export const ORIGIN_STORAGE_KEY = "refundme.stores.origin.v1";
/** A remembered GPS fix older than this is refreshed instead of reused. */
export const ORIGIN_MAX_AGE_MS = 30 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readStoredOrigin(
  storage: StorageLike | null,
  now = Date.now(),
): SearchOrigin | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ORIGIN_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SearchOrigin> & { at?: unknown };
    if (
      typeof value.lat !== "number" ||
      typeof value.lng !== "number" ||
      !Number.isFinite(value.lat) ||
      !Number.isFinite(value.lng) ||
      Math.abs(value.lat) > 90 ||
      Math.abs(value.lng) > 180 ||
      (value.source !== "device" && value.source !== "place") ||
      typeof value.at !== "number" ||
      now - value.at > ORIGIN_MAX_AGE_MS ||
      value.at > now + 60_000
    ) {
      storage.removeItem(ORIGIN_STORAGE_KEY);
      return null;
    }
    return {
      lat: value.lat,
      lng: value.lng,
      source: value.source,
      label: typeof value.label === "string" ? value.label : null,
    };
  } catch {
    return null;
  }
}

export function writeStoredOrigin(
  storage: StorageLike | null,
  origin: SearchOrigin | null,
  now = Date.now(),
): void {
  if (!storage) return;
  try {
    if (!origin) storage.removeItem(ORIGIN_STORAGE_KEY);
    else storage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify({ ...origin, at: now }));
  } catch {
    /* private mode or full storage: the page still works for this visit */
  }
}

/** GeolocationPositionError codes: 1 denied, 2 unavailable, 3 timeout. */
export function geolocationErrorMessage(code: number | "unsupported" | "insecure"): string {
  switch (code) {
    case "unsupported":
      return "הדפדפן הזה לא משתף מיקום. אפשר להקליד עיר או כתובת בתיבת החיפוש.";
    case "insecure":
      return "שיתוף מיקום עובד רק בחיבור מאובטח (https). אפשר להקליד עיר או כתובת.";
    case 1:
      return "המיקום חסום לאתר הזה. אפשר לאשר אותו בהגדרות הדפדפן, או להקליד עיר או כתובת.";
    case 3:
      return "קבלת המיקום לקחה יותר מדי זמן. נסו שוב, או הקלידו עיר או כתובת.";
    default:
      return "לא הצלחנו לקבל מיקום כרגע. נסו שוב, או הקלידו עיר או כתובת.";
  }
}

export function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״`.,()/\\\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every typed word must appear in the name or the address. */
export function rowMatchesFilter(
  row: { name: string; detail: string },
  needle: string,
): boolean {
  const words = foldSearchText(needle).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = foldSearchText(`${row.name} ${row.detail}`);
  return words.every((word) => haystack.includes(word));
}

/** Cards with a close place first; cards with no distance keep their order. */
export function compareByNearest(
  a: { nearestKm: number | null; index: number },
  b: { nearestKm: number | null; index: number },
): number {
  if (a.nearestKm != null && b.nearestKm != null) return a.nearestKm - b.nearestKm;
  if (a.nearestKm != null) return -1;
  if (b.nearestKm != null) return 1;
  return a.index - b.index;
}
