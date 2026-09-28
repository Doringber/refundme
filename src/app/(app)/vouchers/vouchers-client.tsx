"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlock } from "@/components/ui/loading";
import { VoucherCard } from "@/components/vouchers/voucher-card";
import { DOCUMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { useDemo } from "@/lib/demo/context";
import type { DocumentType, VoucherStatus } from "@/lib/types";

export function VouchersClient() {
  const demo = useDemo();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [merchant, setMerchant] = useState(params.get("merchant") ?? "all");
  const [documentType, setDocumentType] = useState<DocumentType | "all">(
    (params.get("type") as DocumentType) || "all",
  );
  const [status, setStatus] = useState<VoucherStatus | "all">(
    (params.get("status") as VoucherStatus) || "all",
  );
  const [expiryBefore, setExpiryBefore] = useState("");

  const merchants = useMemo(
    () => [...new Set(demo.vouchers.map((v) => v.merchantName))].sort(),
    [demo.vouchers],
  );

  const filtered = useMemo(
    () =>
      demo.filter({
        query,
        merchant,
        documentType,
        status,
        expiryBefore: expiryBefore || undefined,
      }),
    [demo, query, merchant, documentType, status, expiryBefore],
  );

  if (!demo.ready) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-forest">הזיכויים שלי</h1>
        <p className="text-sm text-eggplant">חיפוש וסינון לפי חנות, סוג, סטטוס ותוקף</p>
      </div>

      <div className="card-surface grid gap-3 p-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">חיפוש</span>
          <input
            className="input-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חנות, קוד, הערות…"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">חנות</span>
          <select
            className="input-field"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          >
            <option value="all">הכל</option>
            {merchants.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">סוג</span>
          <select
            className="input-field"
            value={documentType}
            onChange={(e) =>
              setDocumentType(e.target.value as DocumentType | "all")
            }
          >
            <option value="all">הכל</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">סטטוס</span>
          <select
            className="input-field"
            value={status}
            onChange={(e) => setStatus(e.target.value as VoucherStatus | "all")}
          >
            <option value="all">הכל</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">תוקף עד תאריך</span>
          <input
            type="date"
            className="input-field"
            value={expiryBefore}
            onChange={(e) => setExpiryBefore(e.target.value)}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="לא נמצאו מסמכים"
          description="נסו לשנות את הסינון או להוסיף זיכוי חדש."
          actionLabel="הוספת זיכוי"
          actionHref="/vouchers/new"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <VoucherCard key={v.id} voucher={v} />
          ))}
        </div>
      )}
    </div>
  );
}
