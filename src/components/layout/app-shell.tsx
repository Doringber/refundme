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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-28 pt-4 md:max-w-5xl md:pb-10 md:pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="group">
          <p className="font-display text-2xl leading-none text-forest md:text-3xl">
            {APP_NAME}
          </p>
          <p className="mt-1 text-xs font-bold tracking-wide text-eggplant">
            הזיכויים שלכם, במקום אחד
          </p>
        </Link>
        <div className="flex items-center gap-2">
          {demo && (
            <span className="badge bg-blush text-forest" title="נתוני דמו מקומיים">
              מצב דמו
            </span>
          )}
          <Link
            href="/vouchers/new"
            className="btn-primary hidden px-5 py-2.5 text-sm md:inline-flex"
          >
            הוספת זיכוי
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Sticky pill nav inspired by gallery 048 Squishy */}
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
