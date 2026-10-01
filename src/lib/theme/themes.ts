export const THEME_STORAGE_KEY = "zikuy-theme";

/** Color-only themes inspired by MiaAI gallery palettes. */
export const THEME_IDS = [
  "neon",
  "tend",
  "aurora",
  "soft",
  "tide",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "neon";

/** Old scenic packs → nearest color palette */
const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  nimbus: "aurora",
  keepers: "tide",
  rain: "neon",
};

export type ThemeMeta = {
  id: ThemeId;
  nameHe: string;
  sourceHe: string;
  /** Swatches shown in the picker */
  swatches: [string, string, string];
  className: `theme-${ThemeId}`;
};

export const THEMES: ThemeMeta[] = [
  {
    id: "neon",
    nameHe: "ניאון כהה",
    sourceHe: "פינטק / כרטיסים צבעוניים",
    swatches: ["#070709", "#2dd4bf", "#f4d03f"],
    className: "theme-neon",
  },
  {
    id: "tend",
    nameHe: "גן ירוק",
    sourceHe: "MiaAI · Tend habit garden",
    swatches: ["#f4f6f0", "#2f4f3a", "#d98e73"],
    className: "theme-tend",
  },
  {
    id: "aurora",
    nameHe: "אורורה זכוכית",
    sourceHe: "MiaAI · Aurora Glass Stillwater",
    swatches: ["#070b1f", "#2de2c4", "#7b5cff"],
    className: "theme-aurora",
  },
  {
    id: "soft",
    nameHe: "חימר רך",
    sourceHe: "MiaAI · Soft Machine",
    swatches: ["#e4e8ee", "#ff6b5a", "#b8bec7"],
    className: "theme-soft",
  },
  {
    id: "tide",
    nameHe: "עורכים / קרם",
    sourceHe: "MiaAI · Tidewater editorial",
    swatches: ["#f6f1e7", "#14213d", "#c0392b"],
    className: "theme-tide",
  },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && (THEME_IDS as readonly string[]).includes(value);
}

export function resolveThemeId(value: string | null | undefined): ThemeId {
  if (isThemeId(value)) return value;
  if (value && value in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[value]!;
  return DEFAULT_THEME;
}

export function themeClassName(id: ThemeId): string {
  return `theme-${id}`;
}

export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const resolved = resolveThemeId(raw);
    if (raw && raw !== resolved) {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
    }
    return resolved;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(id: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("zikuy-theme-changed"));
}
