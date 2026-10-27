"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExpiryNotifier } from "@/components/notifications/expiry-notifier";
import { BuyMeAutoSync } from "@/components/wallet/buyme-auto-sync";
import { useAppData } from "@/lib/app-data/context";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "/dashboard", label: "בית", icon: "home" },
  { href: "/vouchers", label: "זיכויים", icon: "ticket" },
  { href: "/vouchers/new", label: "הוספה", icon: "plus" },
  { href: "/stores", label: "חנויות", icon: "pin" },
  { href: "/settings", label: "הגדרות", icon: "gear" },
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

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(8rem+env(safe-area-inset-bottom))] md:max-w-5xl md:pt-6 md:pb-10"
    >
      <ExpiryNotifier />
      <BuyMeAutoSync />
      <header className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/settings"
          className="chrome-hover flex min-w-0 items-center gap-2 rounded-full py-1 pe-2 ps-1 transition"
          aria-label={displayName ? `הגדרות — ${displayName}` : "הגדרות"}
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
        </Link>
        <div className="flex items-center gap-2">
          {demo && (
            <span className="badge bg-butter text-black" title="נתוני דמו מקומיים">
              דמו
            </span>
          )}
          <Link
            href="/vouchers/new"
            className="btn-primary hidden px-5 py-2.5 text-sm md:inline-flex"
          >
            צילום
          </Link>
        </div>
      </header>

      <main className="page-enter flex-1">{children}</main>

      <nav
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:static md:inset-auto md:bottom-auto md:mt-10"
        aria-label="ניווט ראשי"
      >
        <ul className="pill-nav mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-2 md:flex md:justify-center md:gap-2 md:px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/vouchers"
                ? pathname === "/vouchers" ||
                  (pathname.startsWith("/vouchers/") &&
                    !pathname.startsWith("/vouchers/new"))
                : pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-11 flex-col items-center justify-center rounded-full px-2 py-2 text-xs font-extrabold transition md:flex-row md:gap-2 md:px-4 md:text-sm ${
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
        </ul>
      </nav>
    </div>
  );
}

function NavIcon({ name }: { name: (typeof NAV)[number]["icon"] }) {
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
  if (name === "ticket") {
    return (
      <svg {...common}>
        <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" />
      </svg>
    );
  }
  if (name === "plus") {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
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
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
  );
}
