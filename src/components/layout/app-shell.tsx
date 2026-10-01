"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-28 pt-4 md:max-w-5xl md:pb-10 md:pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="group min-w-0">
          <p className="font-display text-2xl leading-none text-forest md:text-3xl">
            {APP_NAME}
          </p>
          {displayName ? (
            <p className="mt-1 truncate text-xs font-bold text-eggplant">
              שלום, {displayName}
            </p>
          ) : (
            <p className="mt-1 text-xs font-bold tracking-wide text-eggplant">
              הזיכויים שלכם, במקום אחד
            </p>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {demo && (
            <span className="badge bg-blush text-forest" title="נתוני דמו מקומיים">
              מצב דמו
            </span>
          )}
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-full bg-[rgba(47,79,58,0.06)] py-1 pe-3 ps-1 transition hover:bg-[rgba(47,79,58,0.1)]"
            aria-label={displayName ? `הגדרות — ${displayName}` : "הגדרות"}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-sm font-extrabold text-[var(--cream-ink)]">
                {(displayName ?? "?").slice(0, 1)}
              </span>
            )}
            {displayName && (
              <span className="hidden max-w-[8rem] truncate text-sm font-bold text-forest sm:inline">
                {displayName}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav
        className="fixed inset-x-3 bottom-3 z-40 md:static md:inset-auto md:mt-10 md:bottom-auto"
        aria-label="ניווט ראשי"
      >
        <ul className="pill-nav mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-2 md:flex md:justify-center md:gap-2 md:px-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center rounded-full px-2 py-2 text-xs font-extrabold transition md:flex-row md:gap-2 md:px-4 md:text-sm ${
                    active
                      ? "bg-forest text-[var(--cream-ink)] shadow-sm"
                      : "text-eggplant hover:bg-[var(--sage-ll)]"
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
    </div>
  );
}
