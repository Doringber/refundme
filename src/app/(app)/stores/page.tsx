"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  voucherMatchesBranch,
} from "@/lib/stores/nearby";
import type { MerchantBranch, Voucher } from "@/lib/types";

type PlaceHit = {
  name: string;
  address: string | null;
  distanceKm: number;
};

type LookupState = {
  label: string | null;
  brandCount: number | null;
  places: PlaceHit[];
  status: "idle" | "loading" | "ok" | "no_places" | "catalog_unavailable" | "places_unavailable";
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

    void (async () => {
      const next: Record<string, LookupState> = {};
      await Promise.all([
        ...catalogIds.map(async (id) => {
          const key = `catalog:${id}`;
          if (!coords) {
            const res = await fetch(`/api/stores/nearby?id=${id}`);
            const json = (await res.json()) as {
              label?: string | null;
              brandCount?: number | null;
              status?: LookupState["status"];
            };
            next[key] = {
              label: json.label ?? null,
              brandCount: json.brandCount ?? null,
              places: [],
              status: res.ok ? "ok" : "catalog_unavailable",
            };
            return;
          }
          const res = await fetch("/api/stores/nearby", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lat: coords.lat, lng: coords.lng, catalogId: id }),
          });
          const json = (await res.json()) as LookupState;
          next[key] = {
            label: json.label ?? null,
            brandCount: json.brandCount ?? null,
            places: json.places ?? [],
            status: json.status ?? "places_unavailable",
          };
        }),
        ...(coords
          ? targets.merchants.map(async (name) => {
              const res = await fetch("/api/stores/nearby", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  lat: coords.lat,
                  lng: coords.lng,
                  merchantName: name,
                }),
              });
              const json = (await res.json()) as LookupState;
              next[`merchant:${name}`] = {
                label: json.label ?? name,
                brandCount: null,
                places: json.places ?? [],
                status: json.status ?? "places_unavailable",
              };
            })
          : []),
      ]);
      if (!cancelled) setLookups(next);
    })().catch(() => {
      if (!cancelled) setLookups({});
    });
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
            ? "המיקום לא אושר. בלי מיקום אי אפשר למיין לפי מרחק."
            : "לא הצלחנו לקבל מיקום.",
        );
        setLocBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  const waitingForBranches = Boolean(userId) && remoteFor !== userId;
  if (!app.ready || waitingForBranches) return <LoadingBlock />;

  const needle = query.trim().toLowerCase();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-forest">איפה אפשר לממש</h1>
        <p className="text-sm text-eggplant">
          לפי הזיכויים שלכם. כרטיס BuyMe מרובה־מותגים משתמש ברשימה הציבורית של
          BuyMe, והמרחק מגיע מהמפה הפתוחה. המיקום נשאר במכשיר ולא נשמר.
        </p>
      </div>

      <div className="card-surface space-y-3 p-4">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={requestLocation}
          disabled={locBusy}
        >
          {locBusy
            ? "מאתר…"
            : coords
              ? "המיקום פעיל — עדכון"
              : "מציאת בתי עסק לפי המיקום שלי"}
        </button>
        {coords && (
          <button
            type="button"
            className="min-h-11 w-full text-sm font-bold text-eggplant underline"
            onClick={() => setCoords(null)}
          >
            ניקוי המיקום מהמסך
          </button>
        )}
        {locError && (
          <p className="text-sm text-[#a33a28]" role="alert">
            {locError}
          </p>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">סינון</span>
          <input
            className="input-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="שם בית עסק או כתובת"
          />
        </label>
      </div>

      {spendable.length === 0 ? (
        <p className="card-surface px-4 py-6 text-center text-sm text-eggplant">
          אין זיכויים פעילים. אחרי שיופיע זיכוי, נציג בתי עסק שמקבלים אותו.
        </p>
      ) : (
        <div className="space-y-4">
          {spendable.map((voucher) => {
            const catalog = catalogForVoucher(voucher);
            const lookup = lookups[lookupKey(voucher)];
            const local = catalog
              ? []
              : sourceBranches
                  .filter(
                    (branch) =>
                      branch.acceptance !== "not_accepted" &&
                      voucherMatchesBranch(
                        voucher,
                        {
                          ...branch,
                          merchantNameHe:
                            branch.merchantNameHe ??
                            demoNames.get(branch.merchantId) ??
                            undefined,
                        },
                      ),
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
                  .filter((branch) => branch.distanceKm == null || branch.distanceKm <= 40)
                  .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

            const remotePlaces =
              catalog || local.length === 0 ? (lookup?.places ?? []) : [];
            const rows = [
              ...local.map((branch) => ({
                key: branch.id,
                name: branch.merchantNameHe || branch.nameHe,
                detail: `${branch.nameHe} · ${branch.city} · ${branch.addressHe}`,
                distanceKm: branch.distanceKm,
              })),
              ...remotePlaces.map((place, index) => ({
                key: `${place.name}-${index}`,
                name: place.name,
                detail: place.address ?? "כתובת לא פורסמה",
                distanceKm: place.distanceKm,
              })),
            ].filter((row) => {
              if (!needle) return true;
              return (
                row.name.toLowerCase().includes(needle) ||
                row.detail.toLowerCase().includes(needle)
              );
            });

            return (
              <section key={voucher.id} className="card-surface space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-forest">
                      {voucher.merchantName}
                    </h2>
                    <p className="text-sm text-eggplant">
                      יתרה {formatIls(voucher.remainingAmountAgorot)}
                    </p>
                  </div>
                  <Link
                    href={`/vouchers/${voucher.id}`}
                    className="min-h-11 text-sm font-extrabold text-forest"
                  >
                    לשובר
                  </Link>
                </div>
                <VoucherNote
                  catalog={Boolean(catalog)}
                  merchantName={voucher.merchantName}
                  lookup={lookup}
                  hasLocation={coords != null}
                  localCount={local.length}
                />
                {rows.length > 0 && (
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.key}
                        className="flex items-start justify-between gap-3 rounded-2xl bg-white/10 px-3 py-3"
                      >
                        <div>
                          <p className="font-extrabold text-night">{row.name}</p>
                          <p className="text-sm text-eggplant">{row.detail}</p>
                        </div>
                        {row.distanceKm != null && (
                          <p className="text-sm font-extrabold text-forest">
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
  localCount,
}: {
  catalog: boolean;
  merchantName: string;
  lookup: LookupState | undefined;
  hasLocation: boolean;
  localCount: number;
}) {
  if (catalog) {
    if (!lookup || lookup.status === "loading" || lookup.status === "idle") {
      return (
        <p className="text-sm text-eggplant">טוענים את רשימת בתי העסק של BuyMe…</p>
      );
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
          {lookup.label ?? merchantName}. אשרו מיקום כדי לראות מה קרוב.
        </p>
      );
    }
    if (lookup.status === "places_unavailable") {
      return (
        <p className="text-sm text-eggplant">
          הרשימה הציבורית כוללת {lookup.brandCount ?? "כמה"} בתי עסק, אבל חיפוש
          המרחק לא זמין כרגע.
        </p>
      );
    }
    if (lookup.status === "no_places" || lookup.places.length === 0) {
      return (
        <p className="text-sm text-eggplant">
          לא נמצא סניף קרוב מתוך {lookup.brandCount ?? "רשימת"} בתי העסק. ל־BuyMe
          אין נקודת מפה לכל סניף, וההתאמה היא לפי שם מול המפה הפתוחה.
        </p>
      );
    }
    return (
      <p className="text-sm text-eggplant">
        בתי עסק מהרשימה הציבורית של {lookup.label ?? merchantName}, לפי מרחק.
      </p>
    );
  }

  if (localCount > 0) {
    return (
      <p className="text-sm text-eggplant">
        {hasLocation
          ? "סניפים של הרשת הזו לפי מרחק."
          : "סניפים של הרשת הזו. מרחק יופיע אחרי אישור מיקום."}
      </p>
    );
  }
  if (!hasLocation) {
    return (
      <p className="text-sm text-eggplant">
        אין רשימת סניפים שמורה ל־{merchantName}. אשרו מיקום כדי לחפש במפה.
      </p>
    );
  }
  if (!lookup || lookup.status === "places_unavailable") {
    return (
      <p className="text-sm text-eggplant">
        אין מידע על סניפים של {merchantName} ליד המיקום. לא מציגים רשימת רשתות אחרת.
      </p>
    );
  }
  if (lookup.places.length === 0) {
    return (
      <p className="text-sm text-eggplant">
        לא נמצאו סניפים של {merchantName} ליד המיקום.
      </p>
    );
  }
  return (
    <p className="text-sm text-eggplant">מקומות במפה הפתוחה שתואמים ל־{merchantName}.</p>
  );
}
