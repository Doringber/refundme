"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingBlock } from "@/components/ui/loading";
import { useAppData } from "@/lib/app-data/context";
import { formatIls } from "@/lib/calculations";
import { DEMO_BRANCHES, DEMO_MERCHANTS } from "@/lib/demo/data";
import { createClient } from "@/lib/supabase/client";
import {
  formatDistanceKm,
  haversineKm,
  NEARBY_RADIUS_KM,
  nearbyRedeemableCredits,
  voucherMatchesBranch,
} from "@/lib/stores/nearby";
import type { BranchAcceptance, MerchantBranch } from "@/lib/types";

function acceptanceLabel(acceptance: BranchAcceptance): { text: string; cls: string } {
  switch (acceptance) {
    case "verified":
      return { text: "קבלה מאומתת בסניף זה", cls: "badge-pool" };
    case "not_accepted":
      return { text: "לא מתקבל בסניף זה", cls: "badge-poppy" };
    default:
      return { text: "לא אומת — אל תניחו שכל סניף מקבל", cls: "badge-daffodil" };
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

export default function StoresPage() {
  const app = useAppData();
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [remote, setRemote] = useState<MerchantBranch[] | null>(null);
  const [remoteFor, setRemoteFor] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const userId = app.mode === "supabase" ? (app.user?.id ?? null) : null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      setRemoteError(null);
      const [merchantsRes, branchesRes] = await Promise.all([
        supabase.from("merchants").select("id,name_he"),
        supabase
          .from("merchant_branches")
          .select("id,merchant_id,name_he,city,address_he,lat,lng,acceptance,notes_he"),
      ]);
      if (cancelled) return;
      if (merchantsRes.error || branchesRes.error) {
        setRemoteError("לא הצלחנו לטעון את רשימת הסניפים");
        setRemote([]);
        setRemoteFor(userId);
        return;
      }
      const names = new Map(
        (merchantsRes.data ?? []).map((merchant) => [merchant.id, merchant.name_he]),
      );
      setRemote(
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
      setRemoteError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const sourceBranches = useMemo(() => {
    if (app.mode !== "supabase") return DEMO_BRANCHES;
    if (!userId || remoteFor !== userId) return [];
    return remote ?? [];
  }, [app.mode, userId, remote, remoteFor]);
  const demoNames = useMemo(
    () => new Map(DEMO_MERCHANTS.map((merchant) => [merchant.id, merchant.nameHe])),
    [],
  );

  const cities = useMemo(
    () => [...new Set(sourceBranches.map((branch) => branch.city))].sort((a, b) => a.localeCompare(b, "he")),
    [sourceBranches],
  );

  const branches = useMemo(() => {
    let list = sourceBranches.map((branch) => ({
      ...branch,
      merchantNameHe:
        branch.merchantNameHe ?? demoNames.get(branch.merchantId) ?? undefined,
      distanceKm:
        coords && branch.lat != null && branch.lng != null
          ? haversineKm(coords.lat, coords.lng, branch.lat, branch.lng)
          : null,
    }));
    if (city) list = list.filter((branch) => branch.city === city);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (branch) =>
          branch.nameHe.toLowerCase().includes(q) ||
          branch.addressHe.toLowerCase().includes(q) ||
          (branch.merchantNameHe ?? "").toLowerCase().includes(q) ||
          branch.city.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (coords) return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
      return a.city.localeCompare(b.city, "he") || a.nameHe.localeCompare(b.nameHe, "he");
    });
    return list;
  }, [sourceBranches, demoNames, city, query, coords]);

  const credits = useMemo(
    () =>
      nearbyRedeemableCredits(branches, app.vouchers, {
        hasLocation: coords != null,
        city,
      }),
    [branches, app.vouchers, coords, city],
  );

  function requestLocation() {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("הדפדפן אינו תומך במיקום. בחרו עיר במקום.");
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
            ? "המיקום לא אושר. אפשר לבחור עיר או לחפש לפי שם."
            : "לא הצלחנו לקבל מיקום. אפשר לבחור עיר.",
        );
        setLocBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  const waitingForBranches = Boolean(userId) && remoteFor !== userId && !remoteError;
  if (!app.ready || waitingForBranches) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-forest">חנויות בקרבתי</h1>
        <p className="text-sm text-eggplant">
          סניפים לפי מרחק, רק אחרי שתאשרו מיקום. המיקום נשאר במכשיר ולא נשמר
          בחשבון. סימון הקבלה הוא לפי אימות ידני — לא מסיקים שכל סניף מקבל את
          השובר.
        </p>
      </div>

      <div className="card-surface grid gap-3 p-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">עיר</span>
          <select
            className="input-field"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          >
            <option value="">כל הערים</option>
            {cities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">חיפוש</span>
          <input
            className="input-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="רשת, סניף, כתובת…"
          />
        </label>
        <div className="sm:col-span-2 space-y-2">
          <button
            type="button"
            className="btn-secondary w-full py-3"
            onClick={requestLocation}
            disabled={locBusy}
          >
            {locBusy ? "מאתר…" : "מציאת סניפים לפי המיקום שלי"}
          </button>
          {coords && (
            <button
              type="button"
              className="w-full text-xs font-bold text-eggplant underline"
              onClick={() => setCoords(null)}
            >
              ניקוי המיקום מהמסך
            </button>
          )}
          {coords && (
            <p className="text-xs text-eggplant">ממוין לפי מרחק. המיקום לא נשמר.</p>
          )}
          {locError && (
            <p className="text-xs text-[#a33a28]" role="alert">
              {locError}
            </p>
          )}
        </div>
      </div>

      {remoteError && (
        <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="alert">
          {remoteError}
        </p>
      )}

      {credits.length > 0 && (
        <ul className="space-y-2" data-testid="nearby-credits">
          {credits.map((credit) => (
            <li
              key={credit.voucherId}
              className="rounded-2xl bg-[rgba(71,181,168,0.14)] px-4 py-3 text-sm font-bold text-forest"
            >
              {`יש לך זיכוי בשווי ${formatIls(credit.amountAgorot)} שמתאים ל${credit.merchantName} באזור`}
              {credit.nearestBranchName ? ` · ${credit.nearestBranchName}` : ""}
              {credit.distanceKm != null ? ` · ${formatDistanceKm(credit.distanceKm)}` : ""}
            </li>
          ))}
        </ul>
      )}

      {branches.length === 0 ? (
        <p className="card-surface px-4 py-8 text-center text-sm text-eggplant">
          לא נמצאו סניפים לחיפוש הזה.
        </p>
      ) : (
        <ul className="space-y-3">
          {branches.map((branch) => {
            const badge = acceptanceLabel(branch.acceptance);
            const inArea =
              branch.acceptance !== "not_accepted" &&
              (coords
                ? branch.distanceKm != null && branch.distanceKm <= NEARBY_RADIUS_KM
                : city !== "" && branch.city === city);
            const match = inArea
              ? credits.find((credit) => {
                  const voucher = app.vouchers.find((item) => item.id === credit.voucherId);
                  return voucher ? voucherMatchesBranch(voucher, branch) : false;
                })
              : undefined;
            return (
              <li key={branch.id} className="card-surface px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-forest">
                      {branch.merchantNameHe}
                    </p>
                    <p className="font-medium text-night">{branch.nameHe}</p>
                    <p className="text-sm text-eggplant">
                      {branch.city} · {branch.addressHe}
                    </p>
                    {branch.lat == null || branch.lng == null ? (
                      <p className="mt-1 text-xs text-eggplant">אין נקודת מיקום לסניף</p>
                    ) : null}
                    {branch.notesHe && (
                      <p className="mt-1 text-xs text-eggplant">{branch.notesHe}</p>
                    )}
                  </div>
                  {branch.distanceKm != null && (
                    <p className="text-sm font-semibold text-forest">
                      {formatDistanceKm(branch.distanceKm)}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`badge ${badge.cls}`}>{badge.text}</span>
                  {match && (
                    <span className="badge badge-pool">
                      יש לך זיכוי בשווי {formatIls(match.amountAgorot)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
