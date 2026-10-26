import Link from "next/link";

/** Single back control. The arrow points to the right, which is back in RTL. */
export function BackLink({
  href,
  label = "חזרה",
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm font-extrabold text-forest ${className}`}
    >
      <span aria-hidden className="text-base leading-none">
        →
      </span>
      {label}
    </Link>
  );
}
