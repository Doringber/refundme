"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "/dashboard", label: "בית", icon: "◎" },
  { href: "/vouchers", label: "זיכויים", icon: "◇" },
  { href: "/vouchers/new", label: "הוספה", icon: "+" },
  { href: "/stores", label: "חנויות", icon: "⌖" },
  { href: "/settings", label: "הגדרות", icon: "⚙" },
];

export function AppShell({
  children,
  demo,
}: {
  children: React.ReactNode;
  demo?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-28 pt-4 md:max-w-5xl md:pb-10 md:pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="group">
          <p className="font-display text-2xl font-semibold tracking-tight text-night md:text-3xl">
            {APP_NAME}
          </p>
          <p className="text-xs text-eggplant">הזיכויים שלכם, במקום אחד</p>
        </Link>
        <div className="flex items-center gap-2">
          {demo && (
            <span className="badge badge-daffodil" title="נתוני דמו מקומיים">
              מצב דמו
            </span>
          )}
          <Link
            href="/vouchers/new"
            className="btn-primary hidden px-4 py-2 text-sm md:inline-flex"
          >
            הוספת זיכוי
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(37,45,69,0.08)] bg-[rgba(250,247,242,0.92)] backdrop-blur-md md:static md:mt-10 md:border-0 md:bg-transparent md:backdrop-blur-none"
        aria-label="ניווט ראשי"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-2 md:flex md:justify-center md:gap-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center rounded-2xl px-2 py-2 text-xs font-semibold transition md:flex-row md:gap-2 md:px-4 md:text-sm ${
                    active
                      ? "bg-[rgba(71,181,168,0.18)] text-night"
                      : "text-eggplant hover:bg-white/70"
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
