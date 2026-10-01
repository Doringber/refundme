"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BuyMeConnectCard } from "@/components/vouchers/buyme-connect-card";
import { LoadingBlock } from "@/components/ui/loading";
import {
  valuesFromExtraction,
  VoucherReviewForm,
} from "@/components/vouchers/voucher-form";
import { useAppData } from "@/lib/app-data/context";
import {
  BUYME_CONNECTED_MESSAGE,
  parseBuyMePageText,
  readBuyMeImportHash,
  vouchersFromBuyMeApiCards,
  vouchersFromBuyMeGifts,
  type BuyMeApiCard,
} from "@/lib/buyme-import";
import { formatIls, shekelsToAgorot } from "@/lib/calculations";
import type { BuyMeGiftCandidate } from "@/lib/extract";
import type { Voucher } from "@/lib/types";

type Step = "loading" | "connect" | "waiting" | "pick" | "review" | "success";

function notifyOpenerAndClose() {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: BUYME_CONNECTED_MESSAGE },
        window.location.origin,
      );
    }
  } catch {
    /* ignore cross-window issues */
  }
  // Close the temporary connect window when we were opened as a popup.
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
  }, 120);
}

export default function BuyMeImportPage() {
  const app = useAppData();
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [cards, setCards] = useState<BuyMeApiCard[]>([]);
  const [ocrGifts, setOcrGifts] = useState<BuyMeGiftCandidate[]>([]);
  const [reviewFields, setReviewFields] = useState<BuyMeApiCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function loadWallet() {
    const res = await fetch("/api/buyme/wallet");
    const json = (await res.json()) as {
      status?: string;
      cards?: BuyMeApiCard[];
      expiresAt?: string | null;
      error?: string;
    };
    if (json.status === "NEEDS_REAUTH" || res.status === 401) {
      setCards([]);
      setStep("connect");
      return;
    }
    if (!res.ok || json.status !== "OK") {
      setError("שליפת הארנק מ־BuyMe נכשלה");
      setStep("connect");
      return;
    }
    setCards(json.cards ?? []);
    setExpiresAt(json.expiresAt ?? null);
    setOcrGifts([]);
    setStep("pick");
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const { token, pageText } = readBuyMeImportHash(window.location.hash);

      if (token) {
        history.replaceState(null, "", window.location.pathname);
        const res = await fetch("/api/buyme/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setError("החיבור מ־BuyMe לא תקף — התחברו מחדש בחלון ולחצו על כפתור החיבור");
            setStep("connect");
          }
          return;
        }
        // Temporary BuyMe window landed here with the token — hand off to opener.
        if (window.opener && !window.opener.closed) {
          notifyOpenerAndClose();
          if (!cancelled) {
            setStep("success");
            setImportedCount(0);
          }
          return;
        }
        if (!cancelled) await loadWallet();
        return;
      }

      if (pageText?.trim()) {
        history.replaceState(null, "", window.location.pathname);
        const parsed = parseBuyMePageText(pageText);
        if (!cancelled) {
          setOcrGifts(parsed);
          setStep(parsed.length ? "pick" : "connect");
        }
        return;
      }

      const status = await fetch("/api/buyme/session");
      const st = (await status.json()) as { connected?: boolean };
      if (st.connected) {
        if (!cancelled) await loadWallet();
      } else if (!cancelled) {
        setStep("connect");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Parent tab: wait until the popup finishes connecting.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type !== BUYME_CONNECTED_MESSAGE) return;
      setStep("loading");
      void loadWallet();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (step !== "waiting") return;
    const id = window.setInterval(() => {
      void (async () => {
        const status = await fetch("/api/buyme/session");
        const st = (await status.json()) as { connected?: boolean };
        if (st.connected) {
          setStep("loading");
          await loadWallet();
        }
      })();
    }, 1600);
    return () => window.clearInterval(id);
  }, [step]);

  async function disconnect() {
    await fetch("/api/buyme/session", { method: "DELETE" });
    setCards([]);
    setStep("connect");
  }

  async function importAll() {
    setBusy(true);
    setError(null);
    try {
      if (app.mode === "supabase" && !app.user) {
        throw new Error("יש להתחבר כדי לשמור זיכויים בענן");
      }
      const { saved } =
        cards.length > 0
          ? vouchersFromBuyMeApiCards(cards, { userId: app.user?.id })
          : vouchersFromBuyMeGifts(ocrGifts, { userId: app.user?.id });
      if (!saved.length) throw new Error("אין מתנות עם יתרה לייבוא");
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

  if (!app.ready || step === "loading") {
    return <LoadingBlock label="מתחברים לארנק BuyMe…" />;
  }

  const listCount = cards.length || ocrGifts.length;
  const totalShekels =
    cards.length > 0
      ? cards.reduce((s, c) => s + c.balanceShekels, 0)
      : ocrGifts.reduce((s, g) => s + (g.amountAgorot ?? 0), 0) / 100;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/vouchers/new" className="text-sm font-semibold text-forest">
          ← חזרה להוספה
        </Link>
        <h1 className="font-display mt-2 text-2xl text-forest">ייבוא מ־BuyMe</h1>
        <p className="text-sm text-eggplant">
          חלון חיבור זמני → שמירת חיבור → שליפת הארנק ב־API
        </p>
      </div>

      {(step === "connect" || step === "waiting") && (
        <div className="space-y-4">
          {error && (
            <p
              className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm"
              role="alert"
            >
              {error}
            </p>
          )}
          {step === "waiting" && (
            <p
              className="rounded-2xl bg-[rgba(71,181,168,0.14)] px-4 py-3 text-sm font-semibold text-forest"
              role="status"
            >
              ממתינים לחיבור מהחלון של BuyMe… אחרי ההתחברות לחצו שם על כפתור
              החיבור ששמרתם.
            </p>
          )}
          <BuyMeConnectCard onPopupOpened={() => setStep("waiting")} />
          <p className="text-center text-xs text-eggplant">
            או{" "}
            <Link href="/vouchers/new" className="font-bold text-forest">
              צילום מסך אחד של הרשימה
            </Link>{" "}
            כגיבוי
          </p>
        </div>
      )}

      {step === "pick" && (
        <div className="card-surface space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-forest">הארנק שלכם</h2>
              <p className="mt-1 text-sm text-eggplant">
                {listCount} מתנות · סה״כ{" "}
                {formatIls(shekelsToAgorot(totalShekels))}
                {expiresAt
                  ? ` · סשן עד ${new Date(expiresAt).toLocaleDateString("he-IL")}`
                  : ""}
              </p>
            </div>
            {cards.length > 0 && (
              <button
                type="button"
                className="text-xs font-bold text-eggplant underline"
                onClick={() => void disconnect()}
              >
                ניתוק
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-primary w-full py-3.5 text-base"
            disabled={busy || listCount === 0}
            onClick={() => void importAll()}
            data-testid="buyme-import-all"
          >
            {listCount > 1
              ? `ייבוא הכל (${listCount})`
              : listCount === 1
                ? "ייבוא המתנה"
                : "אין מתנות לייבוא"}
          </button>

          <ul className="space-y-2">
            {cards.map((card) => (
              <li key={String(card.id)}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-2xl bg-white/10 px-4 py-3 text-start transition hover:bg-white/16"
                  disabled={busy}
                  onClick={() => {
                    setReviewFields(card);
                    setStep("review");
                  }}
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="font-display text-base">{card.title}</span>
                    <span className="font-display text-lg">
                      {formatIls(shekelsToAgorot(card.balanceShekels))}
                    </span>
                  </span>
                  <span className="text-xs text-eggplant">
                    {card.code ? `קוד ${card.code}` : "בלי קוד"}
                    {card.expiresAt
                      ? ` · תוקף ${card.expiresAt.slice(0, 10)}`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
            {cards.length === 0 &&
              ocrGifts.map((gift) => (
                <li key={`${gift.title}-${gift.amountAgorot ?? "x"}`}>
                  <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                    <span className="font-display">{gift.title}</span>
                    <span className="font-display">
                      {gift.amountAgorot != null
                        ? formatIls(gift.amountAgorot)
                        : "—"}
                    </span>
                  </div>
                </li>
              ))}
          </ul>

          {error && (
            <p
              className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}

      {step === "review" && reviewFields && (
        <div className="card-surface space-y-4 p-5">
          <VoucherReviewForm
            initial={valuesFromExtraction(reviewFields.fields)}
            documentMeta={{ fileName: null, mimeType: null, dataUrl: null }}
            onSubmit={handleSaveOne}
            busy={busy}
          />
        </div>
      )}

      {step === "success" && (
        <div className="card-surface px-6 py-12 text-center" role="status">
          <p className="font-display text-2xl text-forest">
            {importedCount > 0
              ? `יובאו ${importedCount} מתנות`
              : "החיבור נשמר — אפשר לסגור את החלון"}
          </p>
          <p className="mt-2 text-sm text-eggplant">
            {importedCount > 0 ? "חוזרים לבית…" : "החלון הראשי ממשיך לייבוא"}
          </p>
        </div>
      )}
    </div>
  );
}
