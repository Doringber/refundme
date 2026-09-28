import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h3 className="font-display text-xl text-night">{title}</h3>
      <p className="max-w-sm text-sm text-eggplant">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary mt-2 px-5 py-2.5">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
