import Link from "next/link";
import { formatIls } from "@/lib/calculations";
import type { Voucher } from "@/lib/types";
import { ExpiryBadge, StatusBadge, TypeBadge } from "@/components/ui/status-badge";

export function VoucherCard({ voucher }: { voucher: Voucher }) {
  const isReceipt = voucher.documentType === "receipt";
  return (
    <Link
      href={`/vouchers/${voucher.id}`}
      className="card-surface block px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-forest">{voucher.merchantName}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <TypeBadge type={voucher.documentType} />
            <StatusBadge status={voucher.status} />
            <ExpiryBadge
              expiryDate={voucher.expiryDate}
              confidence={voucher.expiryConfidence}
            />
          </div>
        </div>
        <div className="text-left">
          <p className="font-display text-xl text-forest">
            {formatIls(
              isReceipt
                ? voucher.originalAmountAgorot
                : voucher.remainingAmountAgorot,
            )}
          </p>
          <p className="text-xs text-eggplant">
            {isReceipt ? "סכום קבלה" : "יתרה לפי הדיווח שלך"}
          </p>
        </div>
      </div>
    </Link>
  );
}
