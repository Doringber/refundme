"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlock } from "@/components/ui/loading";
import { VoucherCard } from "@/components/vouchers/voucher-card";
import { DOCUMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { useAppData } from "@/lib/app-data/context";
import type { DocumentType, VoucherStatus } from "@/lib/types";

export function VouchersClient() {
  const app = useAppData();
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
    () => [...new Set(app.vouchers.map((v) => v.merchantName))].sort(),
    [app.vouchers],
  );

  const filtered = useMemo(
    () =>
      app.filter({
        query,
        merchant,
        documentType,
        status,
        expiryBefore: expiryBefore || undefined,
      }),
    [app, query, merchant, documentType, status, expiryBefore],
  );

  if (!app.ready) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-forest">השקית</h1>
          <p className="mt-2 text-sm font-semibold text-eggplant">
            כל שובר הוא כרטיס. לחצו לתעודה, או על הכרטיס לפרטים.
          </p>
        </div>
        <BagMascot className="h-24 w-24 shrink-0" mood={filtered.length ? "happy" : "empty"} />
      </div>

      <label className="block text-sm">
        <span className="sr-only">חיפוש</span>
        <input
          className="input-field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש חנות, קוד או הערה"
        />
      </label>

      <details className="ticket-card p-4">
        <summary className="min-h-11 cursor-pointer font-extrabold">סינון</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
      </details>

      {filtered.length === 0 ? (
        <EmptyState
          title="לא נמצאו מסמכים"
          description="נסו לשנות את הסינון או להוסיף זיכוי חדש."
          actionLabel="הוספת זיכוי"
          actionHref="/vouchers/new"
        />
      ) : (
        <div className="stagger-list space-y-3">
          {filtered.map((v) => (
            <VoucherCard key={v.id} voucher={v} />
          ))}
        </div>
      )}
    </div>
  );
}
