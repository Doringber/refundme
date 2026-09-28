import { DOCUMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { DocumentType, ExpiryConfidence, VoucherStatus } from "@/lib/types";
import { expiryUrgency } from "@/lib/calculations";

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
  if (confidence !== "confirmed" || !expiryDate) {
    return <span className="badge badge-sage">תוקף לא אומת</span>;
  }
  const urgency = expiryUrgency(expiryDate, confidence);
  if (urgency === "urgent" || urgency === "expired") {
    return <span className="badge badge-poppy">פג בקרוב · {expiryDate}</span>;
  }
  if (urgency === "upcoming") {
    return <span className="badge badge-daffodil">פג בקרוב · {expiryDate}</span>;
  }
  return <span className="badge badge-pool">בתוקף עד {expiryDate}</span>;
}
