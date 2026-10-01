"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  readStoredTheme,
  THEMES,
  themeClassName,
  writeStoredTheme,
  type ThemeId,
  type ThemeMeta,
} from "./themes";

type ThemeContextValue = {
  themeId: ThemeId;
  theme: ThemeMeta;
  setTheme: (id: ThemeId) => void;
  themes: ThemeMeta[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("zikuy-theme-changed", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("zikuy-theme-changed", onChange);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useSyncExternalStore(
    subscribe,
    readStoredTheme,
    () => DEFAULT_THEME,
  );
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme,
      setTheme: writeStoredTheme,
      themes: THEMES,
    }),
    [themeId, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className={`app-theme ${themeClassName(themeId)}`}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
