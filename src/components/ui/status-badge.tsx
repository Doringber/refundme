import { DOCUMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { DocumentType, ExpiryConfidence, VoucherStatus } from "@/lib/types";
import { expiryIndicatorLabel } from "@/lib/calculations";

export function StatusBadge({ status }: { status: VoucherStatus }) {
  const cls =
    status === "active"
      ? "badge-pool"
      : status === "partially_redeemed"
        ? "badge-lavender"
        : status === "expired"
          ? "badge-poppy"
          : "badge-sage";
  return <span className={`badge ${cls}`}>{STATUS_LABELS[status]}</span>;
}

export function TypeBadge({ type }: { type: DocumentType }) {
  return <span className="badge badge-lavender">{DOCUMENT_TYPE_LABELS[type]}</span>;
}

export function ExpiryBadge({
  expiryDate,
  confidence,
}: {
  expiryDate: string | null;
  confidence: ExpiryConfidence;
}) {
  const { label, tone } = expiryIndicatorLabel(expiryDate, confidence);
  const toneClass =
    tone === "now"
      ? "badge-poppy"
      : tone === "soon"
        ? "badge-daffodil"
        : tone === "calm"
          ? "badge-pool"
          : "badge-sage";
  return (
    <span className={`badge ${toneClass}`}>
      <span className={`expiry-meter tone-${tone}`} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {label}
    </span>
  );
}
