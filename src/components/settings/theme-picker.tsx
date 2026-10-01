"use client";

import { useTheme } from "@/lib/theme/theme-provider";
import type { ThemeId } from "@/lib/theme/themes";

export function ThemePicker({
  onPicked,
}: {
  onPicked?: (id: ThemeId, nameHe: string) => void;
}) {
  const { themeId, setTheme, themes } = useTheme();
  const featured = themes.filter((t) => t.featured);
  const more = themes.filter((t) => !t.featured);

  return (
    <section className="card-surface space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg">רקע וצבעים</h2>
        <p className="mt-1 text-sm text-eggplant">
          אותם אלמנטים (יתרה, עיגול, ניווט, כרטיסים) — רקעים ופלטות שונים.
          בהשראת{" "}
          <a
            href="https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold underline decoration-dotted underline-offset-2"
          >
            גלריית MiaAI
          </a>
          .
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-eggplant">
          רקעים מעוצבים
        </p>
        <ul className="grid gap-3" role="listbox" aria-label="רקעים מעוצבים">
          {featured.map((theme) => {
            const selected = theme.id === themeId;
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`theme-option theme-option-scenic w-full overflow-hidden text-right ${
                    selected ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    setTheme(theme.id);
                    onPicked?.(theme.id, theme.nameHe);
                  }}
                >
                  {theme.previewSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={theme.previewSrc}
                      alt=""
                      className="theme-option-preview"
                    />
                  )}
                  <span className="theme-option-copy">
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
                    <span className="mt-0.5 block text-[11px] font-semibold opacity-80">
                      {theme.sourceHe}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-eggplant">
          עוד פלטות
        </p>
        <ul
          className="grid gap-2 sm:grid-cols-2"
          role="listbox"
          aria-label="עוד פלטות צבע"
        >
          {more.map((theme) => {
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
      </div>
    </section>
  );
}
