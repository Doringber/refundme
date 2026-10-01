"use client";

import { useTheme } from "@/lib/theme/theme-provider";
import type { ThemeId } from "@/lib/theme/themes";

export function ThemePicker({
  onPicked,
}: {
  onPicked?: (id: ThemeId, nameHe: string) => void;
}) {
  const { themeId, setTheme, themes } = useTheme();

  return (
    <section className="card-surface space-y-3 p-5">
      <div>
        <h2 className="font-display text-lg">רקע וצבעים</h2>
        <p className="mt-1 text-sm text-eggplant">
          בחרו עיצוב בהשראת{" "}
          <a
            href="https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold underline decoration-dotted underline-offset-2"
          >
            גלריית MiaAI
          </a>
          . הבחירה נשמרת במכשיר.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2" role="listbox" aria-label="ערכות עיצוב">
        {themes.map((theme) => {
          const selected = theme.id === themeId;
          return (
            <li key={theme.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`theme-option w-full text-right ${
                  selected ? "is-selected" : ""
                }`}
                onClick={() => {
                  setTheme(theme.id);
                  onPicked?.(theme.id, theme.nameHe);
                }}
              >
                <span className="flex gap-1.5" aria-hidden>
                  {theme.swatches.map((color) => (
                    <span
                      key={color}
                      className="theme-swatch"
                      style={{ background: color }}
                    />
                  ))}
                </span>
                <span className="mt-2 block text-sm font-extrabold">
                  {theme.nameHe}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold opacity-70">
                  {theme.sourceHe}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
