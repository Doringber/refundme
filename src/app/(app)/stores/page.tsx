"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { LoadingBlock } from "@/components/ui/loading";
import { useAppData } from "@/lib/app-data/context";
import { formatIls } from "@/lib/calculations";
import { DEMO_BRANCHES, DEMO_MERCHANTS } from "@/lib/demo/data";
import { createClient } from "@/lib/supabase/client";
import { catalogForVoucher } from "@/lib/stores/lookup";
import {
  formatDistanceKm,
  haversineKm,
  isRedeemableVoucher,
  NEARBY_RADIUS_KM,
  voucherMatchesBranch,
} from "@/lib/stores/nearby";
import { parseNearbyPayload, type NearbyPayload } from "@/lib/stores/search";
import type { MerchantBranch, Voucher } from "@/lib/types";

type LookupState = Omit<NearbyPayload, "status"> & {
  status: NearbyPayload["status"] | "idle" | "loading";
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function lookupKey(voucher: Voucher): string {
  const catalog = catalogForVoucher(voucher);
  return catalog ? `catalog:${catalog.id}` : `merchant:${voucher.merchantName}`;
}

function fold(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

async function fetchLookup(url: string, init?: RequestInit): Promise<LookupState> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(16_000),
    });
    const contentType = res.headers.get("content-type");
    const body = contentType?.includes("json") ? await res.json() : null;
    return parseNearbyPayload({ contentType, body });
  } catch {
    return {
      label: null,
      brandCount: null,
      places: [],
      status: "places_unavailable",
    };
  }
}

export default function StoresPage() {
  const app = useAppData();
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<MerchantBranch[] | null>(null);
  const [remoteFor, setRemoteFor] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const userId = app.mode === "supabase" ? (app.user?.id ?? null) : null;

  const spendable = useMemo(
    () => app.vouchers.filter(isRedeemableVoucher),
    [app.vouchers],
  );
  const targets = useMemo(() => {
    const catalogs = new Map<string, string>();
    const merchants = new Set<string>();
    for (const voucher of spendable) {
      const catalog = catalogForVoucher(voucher);
      if (catalog) catalogs.set(catalog.id, catalog.label);
      else merchants.add(voucher.merchantName);
    }
    return {
      catalogs: [...catalogs.entries()],
      merchants: [...merchants],
    };
  }, [spendable]);
  const targetKey = `${targets.catalogs.map(([id]) => id).join(",")}|${targets.merchants.join(",")}|${coords?.lat ?? ""}|${coords?.lng ?? ""}`;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const [merchantsRes, branchesRes] = await Promise.all([
        supabase.from("merchants").select("id,name_he"),
        supabase
          .from("merchant_branches")
          .select("id,merchant_id,name_he,city,address_he,lat,lng,acceptance,notes_he"),
      ]);
      if (cancelled) return;
      if (merchantsRes.error || branchesRes.error) {
        setRemoteBranches([]);
        setRemoteFor(userId);
        return;
      }
      const names = new Map(
        (merchantsRes.data ?? []).map((merchant) => [merchant.id, merchant.name_he]),
      );
      setRemoteBranches(
        (branchesRes.data ?? []).map((row) => ({
          id: row.id,
          merchantId: row.merchant_id,
          nameHe: row.name_he,
          city: row.city,
          addressHe: row.address_he,
          lat: asNumber(row.lat),
          lng: asNumber(row.lng),
          acceptance: row.acceptance,
          notesHe: row.notes_he,
          merchantNameHe: names.get(row.merchant_id),
        })),
      );
      setRemoteFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const catalogIds = targets.catalogs.map(([id]) => id);
    if (!catalogIds.length && !(coords && targets.merchants.length)) return;

    const jobs: Array<{ key: string; run: () => Promise<LookupState> }> = [
      ...catalogIds.map((id) => ({
        key: `catalog:${id}`,
        run: () =>
          coords
            ? fetchLookup("/api/stores/nearby", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ lat: coords.lat, lng: coords.lng, catalogId: id }),
              })
            : fetchLookup(`/api/stores/nearby?id=${id}`),
      })),
      ...(coords
        ? targets.merchants.map((name) => ({
            key: `merchant:${name}`,
            run: () =>
              fetchLookup("/api/stores/nearby", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  lat: coords.lat,
                  lng: coords.lng,
                  merchantName: name,
                }),
              }),
          }))
        : []),
    ];

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLookups((current) => {
        const next = { ...current };
        for (const job of jobs) {
          next[job.key] = {
            label: current[job.key]?.label ?? null,
            brandCount: current[job.key]?.brandCount ?? null,
            places: current[job.key]?.places ?? [],
            status: "loading",
          };
        }
        return next;
      });
      const next: Record<string, LookupState> = {};
      await Promise.all(
        jobs.map(async (job, index) => {
          if (index > 0) await new Promise((resolve) => setTimeout(resolve, index * 120));
          if (cancelled) return;
          next[job.key] = await job.run();
        }),
      );
      if (!cancelled) setLookups(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetKey, coords, targets.catalogs, targets.merchants]);

  const sourceBranches = useMemo(() => {
    if (app.mode !== "supabase") return DEMO_BRANCHES;
    if (!userId || remoteFor !== userId) return [];
    return remoteBranches ?? [];
  }, [app.mode, userId, remoteBranches, remoteFor]);
  const demoNames = useMemo(
    () => new Map(DEMO_MERCHANTS.map((merchant) => [merchant.id, merchant.nameHe])),
    [],
  );

  function requestLocation() {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("הדפדפן אינו תומך במיקום.");
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocBusy(false);
      },
      (err) => {
        setLocError(
          err.code === 1
            ? "בלי אישור מיקום אי אפשר להראות מה באמת קרוב. אפשר לאשר שוב מההגדרות של הדפדפן."
            : "לא הצלחנו לקבל מיקום. נסו שוב בעוד רגע.",
        );
        setLocBusy(false);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  }

  const waitingForBranches = Boolean(userId) && remoteFor !== userId;
  if (!app.ready || waitingForBranches) return <LoadingBlock label="פותחים את המפה…" />;

  const needle = query.trim().toLowerCase();

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-forest">איפה לממש</h1>
          <p className="mt-3 max-w-sm text-sm font-semibold text-eggplant">
            רק בתי עסק שמתאימים לזיכויים שלכם. המיקום נשאר במכשיר.
          </p>
        </div>
        <BagMascot mood={coords ? "walk" : "happy"} className="h-28 w-28 shrink-0" />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          className="btn-primary w-full text-base"
          onClick={requestLocation}
          disabled={locBusy}
        >
          {locBusy ? "מחפשים סביבתכם…" : coords ? "עדכון המיקום" : "הצגת בתי עסק קרובים"}
        </button>
        {coords && (
          <button
            type="button"
            className="min-h-11 w-full text-sm font-bold text-eggplant underline"
            onClick={() => setCoords(null)}
          >
            בלי מיקום
          </button>
        )}
        {locError && (
          <p className="text-sm font-bold text-[#a33a28]" role="alert">
            {locError}
          </p>
        )}
        <label className="block text-sm">
          <span className="sr-only">סינון</span>
          <input
            className="input-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש בית עסק"
          />
        </label>
      </div>

      {spendable.length === 0 ? (
        <div className="ticket-card flex flex-col items-center px-6 py-8 text-center">
          <BagMascot mood="empty" className="h-28 w-28" />
          <p className="mt-2 font-display text-xl">השקית ריקה</p>
          <p className="mt-1 text-sm text-eggplant">
            אחרי שיופיע זיכוי, נראה איפה אפשר לממש אותו.
          </p>
          <Link href="/vouchers/new" className="btn-primary mt-4 px-6">
            צילום זיכוי
          </Link>
        </div>
      ) : (
        <div className="stagger-list space-y-4">
          {spendable.map((voucher) => {
            const catalog = catalogForVoucher(voucher);
            const key = lookupKey(voucher);
            const stored = lookups[key];
            const lookup =
              !coords && key.startsWith("merchant:") ? undefined : stored;
            const local = catalog
              ? []
              : sourceBranches
                  .filter(
                    (branch) =>
                      branch.acceptance !== "not_accepted" &&
                      voucherMatchesBranch(voucher, {
                        ...branch,
                        merchantNameHe:
                          branch.merchantNameHe ??
                          demoNames.get(branch.merchantId) ??
                          undefined,
                      }),
                  )
                  .map((branch) => ({
                    ...branch,
                    merchantNameHe:
                      branch.merchantNameHe ?? demoNames.get(branch.merchantId),
                    distanceKm:
                      coords && branch.lat != null && branch.lng != null
                        ? haversineKm(coords.lat, coords.lng, branch.lat, branch.lng)
                        : null,
                  }))
                  .filter(
                    (branch) =>
                      branch.distanceKm == null || branch.distanceKm <= NEARBY_RADIUS_KM,
                  );

            const remotePlaces = lookup?.places ?? [];
            const seen = new Set<string>();
            const rows = [
              ...local.map((branch) => ({
                key: branch.id,
                name: branch.nameHe,
                detail: [branch.city, branch.addressHe].filter(Boolean).join(" · "),
                distanceKm: branch.distanceKm,
              })),
              ...remotePlaces.map((place, index) => ({
                key: `osm-${place.name}-${index}`,
                name: place.name,
                detail: place.address ?? "כתובת לא פורסמה במפה",
                distanceKm: place.distanceKm,
              })),
            ]
              .filter((row) => {
                const stamp = `${fold(row.name)}:${row.distanceKm == null ? "x" : Math.round(row.distanceKm * 5)}`;
                if (seen.has(stamp)) return false;
                seen.add(stamp);
                if (!needle) return true;
                return (
                  row.name.toLowerCase().includes(needle) ||
                  row.detail.toLowerCase().includes(needle)
                );
              })
              .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

            return (
              <section key={voucher.id} className="ticket-card space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl leading-none text-forest">
                      {voucher.merchantName}
                    </h2>
                    <p className="mt-2 text-sm font-bold text-eggplant">
                      נשאר {formatIls(voucher.remainingAmountAgorot)}
                    </p>
                  </div>
                  <Link
                    href={`/vouchers/${voucher.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-extrabold text-forest underline"
                  >
                    לשובר
                  </Link>
                </div>
                <VoucherNote
                  catalog={Boolean(catalog)}
                  merchantName={voucher.merchantName}
                  lookup={lookup}
                  hasLocation={coords != null}
                  rowCount={rows.length}
                />
                {lookup?.status === "loading" && rows.length === 0 && (
                  <div className="space-y-2" aria-hidden>
                    <div className="skeleton h-16 w-full" />
                    <div className="skeleton h-16 w-full" />
                  </div>
                )}
                {rows.length > 0 && (
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.key}
                        className="flex items-start justify-between gap-3 rounded-2xl bg-[color:var(--sage-ll)] px-3 py-3"
                      >
                        <div>
                          <p className="font-extrabold text-night">{row.name}</p>
                          <p className="text-sm text-eggplant">{row.detail}</p>
                        </div>
                        {row.distanceKm != null && (
                          <p className="rounded-full bg-[var(--butter)] px-2 py-1 text-sm font-extrabold text-[#1c1c1c]">
                            {formatDistanceKm(row.distanceKm)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VoucherNote({
  catalog,
  merchantName,
  lookup,
  hasLocation,
  rowCount,
}: {
  catalog: boolean;
  merchantName: string;
  lookup: LookupState | undefined;
  hasLocation: boolean;
  rowCount: number;
}) {
  if (lookup?.status === "loading" && rowCount === 0) {
    return <p className="text-sm text-eggplant">מחפשים בתי עסק על המפה…</p>;
  }
  if (catalog) {
    if (!lookup || lookup.status === "idle") {
      return <p className="text-sm text-eggplant">טוענים את רשימת בתי העסק של BuyMe…</p>;
    }
    if (lookup.status === "catalog_unavailable") {
      return (
        <p className="text-sm text-eggplant">
          לא הצלחנו לטעון את הרשימה הציבורית של BuyMe לשובר הזה.
        </p>
      );
    }
    if (!hasLocation) {
      return (
        <p className="text-sm text-eggplant">
          BuyMe מפרסם {lookup.brandCount ?? "רשימת"} בתי עסק שמקבלים את{" "}
          {lookup.label ?? merchantName}. לחצו למעלה כדי לראות מה קרוב אליכם.
        </p>
      );
    }
    if (lookup.status === "places_unavailable") {
      return (
        <p className="text-sm text-eggplant" role="status">
          הרשימה הציבורית כוללת {lookup.brandCount ?? "כמה"} בתי עסק, אבל המפה
          הפתוחה לא הגיבה בזמן. נסו לעדכן את המיקום שוב.
        </p>
      );
    }
    if (lookup.status === "no_places" || rowCount === 0) {
      return (
        <p className="text-sm text-eggplant">
          לא נמצא סניף קרוב מתוך {lookup.brandCount ?? "רשימת"} בתי העסק. ההתאמה
          היא לפי שם מול המפה הפתוחה, ואין נקודה לכל סניף.
        </p>
      );
    }
    return (
      <p className="text-sm text-eggplant">
        בתי עסק מהרשימה של {lookup.label ?? merchantName}, לפי המרחק אליכם.
      </p>
    );
  }

  if (!hasLocation) {
    return (
      <p className="text-sm text-eggplant">
        {rowCount > 0
          ? "סניפים ששמורים אצלנו. מרחק יופיע אחרי אישור מיקום."
          : `אין רשימת סניפים שמורה ל־${merchantName}. אשרו מיקום כדי לחפש במפה.`}
      </p>
    );
  }
  if (lookup?.status === "places_unavailable" && rowCount === 0) {
    return (
      <p className="text-sm text-eggplant" role="status">
        המפה הפתוחה לא הגיבה בזמן עבור {merchantName}. לא מציגים רשת אחרת. נסו שוב
        בעוד רגע.
      </p>
    );
  }
  if (rowCount === 0) {
    return (
      <p className="text-sm text-eggplant">
        לא נמצאו סניפים של {merchantName} בטווח של {NEARBY_RADIUS_KM} ק״מ.
      </p>
    );
  }
  return <p className="text-sm text-eggplant">סניפים של {merchantName} לפי המרחק אליכם.</p>;
}
