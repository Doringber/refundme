import Link from "next/link";
import { BagMascot } from "@/components/illustrations/bag-mascot";

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
    <div className="ticket-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <BagMascot mood="empty" className="h-28 w-28" />
      <h3 className="font-display text-2xl text-forest">{title}</h3>
      <p className="max-w-sm text-sm text-eggplant">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary mt-2 px-5 py-2.5">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
