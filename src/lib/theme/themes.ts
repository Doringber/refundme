export const THEME_STORAGE_KEY = "zikuy-theme";

/** Visual themes inspired by MiaAI gallery HTML demos + scenic packs. */
export const THEME_IDS = [
  "nimbus",
  "keepers",
  "rain",
  "neon",
  "tend",
  "aurora",
  "soft",
  "tide",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "neon";

export type ThemeMeta = {
  id: ThemeId;
  nameHe: string;
  sourceHe: string;
  /** Swatches shown in the picker */
  swatches: [string, string, string];
  className: `theme-${ThemeId}`;
  /** Optional preview / full-bleed photo */
  previewSrc?: string;
  featured?: boolean;
};

export const THEMES: ThemeMeta[] = [
  {
    id: "nimbus",
    nameHe: "נימבוס שמיים",
    sourceHe: "זכוכית על שמיים בהירים",
    swatches: ["#7eb6e8", "#ffffff", "#1e3a5f"],
    className: "theme-nimbus",
    previewSrc: "/themes/nimbus-sky.jpg",
    featured: true,
  },
  {
    id: "keepers",
    nameHe: "מגדלור",
    sourceHe: "MiaAI · The Last Keepers",
    swatches: ["#0b1c3a", "#c0392b", "#f6c39a"],
    className: "theme-keepers",
    previewSrc: "/themes/keepers-lighthouse.jpg",
    featured: true,
  },
  {
    id: "rain",
    nameHe: "גשם ניאון",
    sourceHe: "MiaAI · Neon Rain",
    swatches: ["#05010f", "#ff2a6d", "#05d9e8"],
    className: "theme-rain",
    previewSrc: "/themes/neon-rain.jpg",
    featured: true,
  },
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

export function themeClassName(id: ThemeId): string {
  return `theme-${id}`;
}

export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME;
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
