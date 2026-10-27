"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { useAppData } from "@/lib/app-data/context";

export default function JoinHouseholdPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const app = useAppData();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", token }),
      });
      const json = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setMessage(json.message || "ההצטרפות נכשלה");
        return;
      }
      router.push("/vouchers");
      router.refresh();
    } catch {
      setMessage("ההצטרפות נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="mascot-hello mx-auto w-fit">
        <BagMascot className="h-36 w-36" mood="celebrate" />
      </div>
      <h1 className="text-center font-display text-4xl leading-none text-forest">
        מזמינים אתכם
        <br />
        לארנק.
      </h1>
      {app.mode === "demo" ? (
        <p className="text-center text-sm font-semibold text-eggplant">
          בדמו אין חשבון שני. ההזמנה נשמרת במכשיר הזה. בן או בת זוג צריכים
          להתחבר עם Google מהקישור בטלפון שלהם.
        </p>
      ) : (
        <>
          <p className="text-center text-sm font-semibold text-eggplant">
            אחרי ההצטרפות תראו זיכויים שסומנו כמשותפים. אתם רושמים מימוש על שמכם,
            בלי לערוך את הזיכוי של מי שהזמין.
          </p>
          <button
            type="button"
            className="btn-primary w-full py-3.5"
            disabled={busy}
            onClick={() => void accept()}
          >
            {busy ? "מצטרפים…" : "הצטרפות לארנק"}
          </button>
        </>
      )}
      {message ? (
        <p className="text-center text-sm font-bold text-[#a33a28]" role="alert">
          {message}
        </p>
      ) : null}
      <p className="text-center text-sm">
        <Link href="/settings" className="font-extrabold text-forest">
          להגדרות
        </Link>
      </p>
    </div>
  );
}
