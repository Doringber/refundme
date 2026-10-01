"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { formatIls } from "@/lib/calculations";

export type NeonStackItem = {
  id: string;
  title: string;
  subtitle?: string;
  amountLabel?: string;
  detail: string;
  href?: string;
  ctaLabel?: string;
};

function toMerchantItems(
  merchants: {
    merchantName: string;
    count: number;
    totalAgorot: number;
  }[],
): NeonStackItem[] {
  return merchants.map((m) => ({
    id: m.merchantName,
    title: m.merchantName,
    subtitle: `${m.count} מסמכים`,
    amountLabel: formatIls(m.totalAgorot),
    detail: `סה״כ זיכוי פעיל ב${m.merchantName}. לחצו לצפייה ברשימה המסוננת.`,
    href: `/vouchers?merchant=${encodeURIComponent(m.merchantName)}`,
    ctaLabel: "לצפייה",
  }));
}

/** Colorful accordion stack for real merchant breakdown only. */
export function NeonCardStack({
  merchants = [],
}: {
  merchants?: {
    merchantName: string;
    count: number;
    totalAgorot: number;
  }[];
}) {
  const baseId = useId();
  const items = useMemo(() => toMerchantItems(merchants), [merchants]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId =
    selectedId && items.some((item) => item.id === selectedId)
      ? selectedId
      : (items[0]?.id ?? "");

  if (items.length === 0) return null;

  return (
    <div
      className="neon-card-stack neon-stack-enter"
      role="listbox"
      aria-label="לפי חנות"
      aria-activedescendant={
        activeId ? `${baseId}-${activeId}` : undefined
      }
    >
      {items.map((item, index) => {
        const open = item.id === activeId;
        const panelId = `${baseId}-panel-${item.id}`;
        return (
          <div
            key={item.id}
            id={`${baseId}-${item.id}`}
            role="option"
            aria-selected={open}
            className={`neon-stack-card neon-stack-tone-${(index % 5) + 1} ${
              open ? "is-open" : "is-closed"
            }`}
          >
            <button
              type="button"
              className="neon-stack-trigger"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="min-w-0 text-right">
                <span className="block truncate text-sm font-extrabold">
                  {item.title}
                </span>
                {item.subtitle && (
                  <span className="mt-0.5 block text-xs font-bold opacity-70">
                    {item.subtitle}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {item.amountLabel && (
                  <span className="font-display text-lg">{item.amountLabel}</span>
                )}
                <span
                  className={`neon-stack-chevron ${open ? "is-open" : ""}`}
                  aria-hidden
                >
                  ▾
                </span>
              </span>
            </button>

            <div
              id={panelId}
              className="neon-stack-panel"
              {...(!open ? { inert: true as const } : {})}
            >
              <div className="neon-stack-panel-inner">
                <p className="text-xs font-bold leading-relaxed opacity-80">
                  {item.detail}
                </p>
                {item.href && item.ctaLabel && (
                  <Link
                    href={item.href}
                    className="neon-stack-cta"
                    tabIndex={open ? 0 : -1}
                  >
                    {item.ctaLabel}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
