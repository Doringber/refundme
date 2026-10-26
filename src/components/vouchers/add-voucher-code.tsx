"use client";

import { useState } from "react";
import { voucherCodeInputError } from "@/lib/vouchers/checkout-display";

export function AddVoucherCodeForm({
  onSave,
}: {
  onSave: (code: string) => Promise<void> | void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = voucherCodeInputError(code);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(code.trim());
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-2 text-right">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">הוספת קוד שובר</span>
        <input
          className="input-field"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          inputMode="text"
          placeholder="הקוד שמופיע על השובר"
        />
      </label>
      {error && (
        <p className="text-sm text-[#a33a28]" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-secondary w-full py-2.5 text-sm" disabled={busy}>
        {busy ? "שומרים…" : "שמירת קוד"}
      </button>
    </form>
  );
}
