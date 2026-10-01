"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BuyMeBookmarkCard } from "@/components/vouchers/buyme-bookmark-card";
import { BuyMeGiftImportPanel } from "@/components/vouchers/buyme-gift-import";
import { LoadingBlock } from "@/components/ui/loading";
import {
  valuesFromExtraction,
  VoucherReviewForm,
} from "@/components/vouchers/voucher-form";
import { useAppData } from "@/lib/app-data/context";
import {
  parseBuyMePageText,
  readBuyMeImportHash,
  vouchersFromBuyMeGifts,
} from "@/lib/buyme-import";
import type { BuyMeGiftCandidate } from "@/lib/extract";
import type { Voucher } from "@/lib/types";

type Step = "waiting" | "pick" | "review" | "success" | "empty";

export default function BuyMeImportPage() {
  const app = useAppData();
  const router = useRouter();
  const [step, setStep] = useState<Step>("waiting");
  const [gifts, setGifts] = useState<BuyMeGiftCandidate[]>([]);
  const [fieldsGift, setFieldsGift] = useState<BuyMeGiftCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    function ingest(hash: string) {
      const text = readBuyMeImportHash(hash);
      if (!text.trim()) {
        setStep("empty");
        return;
      }
      const parsed = parseBuyMePageText(text);
      setGifts(parsed);
      setStep(parsed.length ? "pick" : "empty");
    }

    ingest(window.location.hash);
    const onHash = () => ingest(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function importAll() {
    setBusy(true);
    setError(null);
    try {
      if (app.mode === "supabase" && !app.user) {
        throw new Error("יש להתחבר כדי לשמור זיכויים בענן");
      }
      const { saved } = vouchersFromBuyMeGifts(gifts, {
        userId: app.user?.id,
      });
      if (!saved.length) {
        throw new Error("אין מתנות עם יתרה לייבוא");
      }
      for (const v of saved) {
        await app.saveVoucher(v);
      }
      setImportedCount(saved.length);
      setStep("success");
      window.setTimeout(() => router.push("/dashboard"), 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "הייבוא נכשל");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveOne(voucher: Voucher) {
    setBusy(true);
    setError(null);
    try {
      if (app.mode === "supabase" && !app.user) {
        throw new Error("יש להתחבר כדי לשמור זיכויים בענן");
      }
      await app.saveVoucher(voucher);
      setImportedCount(1);
      setStep("success");
      window.setTimeout(() => router.push("/dashboard"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  if (!app.ready) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/vouchers/new" className="text-sm font-semibold text-forest">
          ← חזרה להוספה
        </Link>
        <h1 className="font-display mt-2 text-2xl text-forest">ייבוא מ־BuyMe</h1>
        <p className="text-sm text-eggplant">
          בלי לצלם כל מתנה — מהרשימה או מהסימנייה ב־BuyMe
        </p>
      </div>

      {step === "waiting" && <LoadingBlock label="קורא את המתנות מ־BuyMe…" />}

      {step === "empty" && (
        <div className="space-y-4">
          <div className="card-surface space-y-3 p-5">
            <p className="text-sm text-eggplant">
              עדיין אין נתונים לייבוא. התקינו את הסימנייה, פתחו ב־BuyMe את
              «המתנות שלי», ולחצו עליה — או צלמו־מסך אחד של כל הרשימה ממסך ההוספה.
            </p>
            <Link href="/vouchers/new" className="btn-secondary inline-flex px-4 py-2 text-sm">
              למסך ההוספה
            </Link>
          </div>
          <BuyMeBookmarkCard />
        </div>
      )}

      {step === "pick" && (
        <>
          <BuyMeGiftImportPanel
            gifts={gifts}
            note="המתנות נשלפו מעמוד BuyMe. ייבוא הכל שומר שם + יתרה למעקב (הקוד נשאר ב־BuyMe למימוש)."
            busy={busy}
            onImportAll={() => void importAll()}
            onPickOne={(gift) => {
              setFieldsGift(gift);
              setStep("review");
            }}
            onBack={() => router.push("/vouchers/new")}
          />
          {error && (
            <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="alert">
              {error}
            </p>
          )}
        </>
      )}

      {step === "review" && fieldsGift && (
        <div className="card-surface space-y-4 p-5">
          <VoucherReviewForm
            initial={valuesFromExtraction(fieldsGift.fields)}
            documentMeta={{ fileName: null, mimeType: null, dataUrl: null }}
            onSubmit={handleSaveOne}
            busy={busy}
          />
          {error && (
            <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {step === "success" && (
        <div className="card-surface px-6 py-12 text-center" role="status">
          <p className="font-display text-2xl text-forest">
            יובאו {importedCount} מתנות
          </p>
          <p className="mt-2 text-sm text-eggplant">חוזרים לבית…</p>
        </div>
      )}
    </div>
  );
}
