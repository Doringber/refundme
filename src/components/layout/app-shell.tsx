"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ExpiryNotifier } from "@/components/notifications/expiry-notifier";
import { NearCreditBanner } from "@/components/stores/near-credit-banner";
import { BuyMeAutoSync } from "@/components/wallet/buyme-auto-sync";
import { useAppData } from "@/lib/app-data/context";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "/dashboard", label: "בית", icon: "home" },
  { href: "/stores", label: "איפה", icon: "pin" },
] as const;

const MORE = [
  { href: "/vouchers/new", label: "צילום זיכוי" },
  { href: "/vouchers", label: "הזיכויים" },
  { href: "/activity", label: "פעילות" },
  { href: "/settings", label: "הגדרות" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const app = useAppData();
  const demo = app.mode === "demo";
  const displayName =
    app.profile.displayName ||
    app.user?.user_metadata?.full_name ||
    app.user?.user_metadata?.name ||
    app.user?.email?.split("@")[0] ||
    null;
  const avatarUrl =
    app.profile.avatarUrl ||
    (typeof app.user?.user_metadata?.avatar_url === "string"
      ? app.user.user_metadata.avatar_url
      : typeof app.user?.user_metadata?.picture === "string"
        ? app.user.user_metadata.picture
        : null);

  const isHome = pathname === "/dashboard";
  const shortName = displayName?.trim().split(/[\s@._-]+/)[0] || null;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(8rem+env(safe-area-inset-bottom))] md:max-w-5xl md:pt-6 md:pb-10"
    >
      <ExpiryNotifier />
      <BuyMeAutoSync />
      <header className="mb-5 flex items-center justify-between gap-3">
        <div
          className="flex min-w-0 items-center gap-2 rounded-full py-1 pe-2 ps-1"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[color:var(--chrome-ring)]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="chrome-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">
              {(shortName ?? displayName ?? "?").slice(0, 1)}
            </span>
          )}
          {!isHome && (
            <span className="min-w-0">
              <span className="chrome-ink block font-display text-lg leading-none md:text-xl">
                {APP_NAME}
              </span>
              {displayName && (
                <span className="chrome-muted mt-1 block truncate text-xs font-bold">
                  {displayName}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {demo && (
            <span className="badge bg-butter text-black" title="נתוני דמו מקומיים">
              דמו
            </span>
          )}
        </div>
      </header>

      {pathname !== "/stores/near" && <NearCreditBanner />}
      <main className="flex-1">
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>

      <nav
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:static md:inset-auto md:bottom-auto md:mt-10"
        aria-label="ניווט ראשי"
      >
        <ul className="pill-nav mx-auto grid max-w-3xl grid-cols-3 gap-1 px-2 py-2 md:flex md:justify-center md:gap-2 md:px-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`pressable flex min-h-11 flex-col items-center justify-center rounded-full px-2 py-2 text-xs font-extrabold md:flex-row md:gap-2 md:px-4 md:text-sm ${
                    active ? "nav-link-active" : "nav-link-idle"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="relative">
            <button
              type="button"
              className={`pressable flex min-h-11 w-full flex-col items-center justify-center rounded-full px-2 py-2 text-xs font-extrabold md:flex-row md:gap-2 md:px-4 md:text-sm ${
                moreOpen || moreActive ? "nav-link-active" : "nav-link-idle"
              }`}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <NavIcon name="more" />
              עוד
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="menu-pop card-surface absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-44 space-y-1 p-2 md:left-auto md:right-0"
              >
                {MORE.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className="pressable block min-h-11 rounded-2xl px-3 py-2 text-sm font-extrabold text-forest"
                    onClick={() => setMoreOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </li>
        </ul>
      </nav>
    </div>
  );
}

function NavIcon({ name }: { name: (typeof NAV)[number]["icon"] | "more" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M7 10.5V20h10v-9.5" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg {...common}>
        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    );
  }
  if (name === "more") {
    return (
      <svg {...common}>
        <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
  );
}
