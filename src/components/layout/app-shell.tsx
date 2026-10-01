"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExpiryNotifier } from "@/components/notifications/expiry-notifier";
import { BuyMeAutoSync } from "@/components/wallet/buyme-auto-sync";
import { useAppData } from "@/lib/app-data/context";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "/dashboard", label: "בית", icon: "◎" },
  { href: "/vouchers", label: "זיכויים", icon: "◇" },
  { href: "/vouchers/new", label: "הוספה", icon: "+" },
  { href: "/stores", label: "חנויות", icon: "⌖" },
  { href: "/settings", label: "הגדרות", icon: "⚙" },
];

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

  const isPresent = pathname.includes("/present");
  const isHome = pathname === "/dashboard";
  const shortName = displayName?.trim().split(/[\s@._-]+/)[0] || null;

  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pt-4 md:max-w-5xl md:pt-6 ${
        isPresent ? "pb-4 md:pb-4" : "pb-28 md:pb-10"
      }`}
    >
      <ExpiryNotifier />
      <BuyMeAutoSync />
      {!isPresent && (
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
          <span className="min-w-0">
            {isHome ? (
              <span className="chrome-ink block truncate font-display text-lg leading-none md:text-xl">
                {shortName ? `היי ${shortName}` : "היי"}
              </span>
            ) : (
              <>
                <span className="chrome-ink block font-display text-lg leading-none md:text-xl">
                  {APP_NAME}
                </span>
                {displayName && (
                  <span className="chrome-muted mt-1 block truncate text-xs font-bold">
                    {displayName}
                  </span>
                )}
              </>
            )}
          </span>
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
      )}

      <main className="flex-1">{children}</main>

      {!isPresent && (
      <nav
        className="fixed inset-x-3 bottom-3 z-40 md:static md:inset-auto md:mt-10 md:bottom-auto"
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
                  className={`flex flex-col items-center rounded-full px-2 py-2 text-xs font-extrabold transition md:flex-row md:gap-2 md:px-4 md:text-sm ${
                    active ? "nav-link-active" : "nav-link-idle"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span aria-hidden className="text-base md:text-lg">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}
    </div>
  );
}
