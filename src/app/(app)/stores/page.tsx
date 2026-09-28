"use client";

import { useMemo, useState } from "react";
import { DEMO_BRANCHES, DEMO_MERCHANTS } from "@/lib/demo/data";
import type { BranchAcceptance } from "@/lib/types";

function acceptanceLabel(a: BranchAcceptance): { text: string; cls: string } {
  switch (a) {
    case "verified":
      return { text: "קבלה מאומתת בסניף זה", cls: "badge-pool" };
    case "not_accepted":
      return { text: "לא מתקבל בסניף זה", cls: "badge-poppy" };
    default:
      return { text: "לא אומת — אל תניחו שכל סניף מקבל", cls: "badge-daffodil" };
  }
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StoresPage() {
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locError, setLocError] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  const cities = useMemo(
    () => [...new Set(DEMO_BRANCHES.map((b) => b.city))].sort(),
    [],
  );

  const branches = useMemo(() => {
    let list = DEMO_BRANCHES.map((b) => ({
      ...b,
      merchantNameHe:
        b.merchantNameHe ??
        DEMO_MERCHANTS.find((m) => m.id === b.merchantId)?.nameHe,
      distanceKm:
        coords && b.lat != null && b.lng != null
          ? haversineKm(coords.lat, coords.lng, b.lat, b.lng)
          : null,
    }));

    if (city) list = list.filter((b) => b.city === city);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.nameHe.toLowerCase().includes(q) ||
          b.addressHe.toLowerCase().includes(q) ||
          (b.merchantNameHe ?? "").toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q),
      );
    }
    if (coords) {
      list = [...list].sort(
        (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999),
      );
    }
    return list;
  }, [city, query, coords]);

  function requestLocation() {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("הדפדפן אינו תומך במיקום");
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocBusy(false);
      },
      () => {
        setLocError("לא ניתן לקבל מיקום. אפשר לחפש לפי עיר.");
        setLocBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-forest">חנויות בקרבתי</h1>
        <p className="text-sm text-eggplant">
          מאגר סניפים קטן לתחזוקה. סימון הקבלה הוא לפי אימות ידני — לא מסיקים שכל
          סניף מקבל את השובר.
        </p>
      </div>

      <div className="card-surface grid gap-3 p-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">עיר</span>
          <select
            className="input-field"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">כל הערים</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">חיפוש</span>
          <input
            className="input-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="רשת, סניף, כתובת…"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="button"
            className="btn-secondary w-full py-3"
            onClick={requestLocation}
            disabled={locBusy}
          >
            {locBusy ? "מאתר…" : "שימוש במיקום הנוכחי (אופציונלי)"}
          </button>
          {coords && (
            <p className="mt-2 text-xs text-eggplant">
              ממוין לפי מרחק מהמיקום שלכם
            </p>
          )}
          {locError && (
            <p className="mt-2 text-xs text-[#a33a28]" role="alert">
              {locError}
            </p>
          )}
        </div>
      </div>

      <ul className="space-y-3">
        {branches.map((b) => {
          const badge = acceptanceLabel(b.acceptance);
          return (
            <li key={b.id} className="card-surface px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-forest">
                    {b.merchantNameHe}
                  </p>
                  <p className="font-medium text-night">{b.nameHe}</p>
                  <p className="text-sm text-eggplant">
                    {b.city} · {b.addressHe}
                  </p>
                  {b.notesHe && (
                    <p className="mt-1 text-xs text-eggplant">{b.notesHe}</p>
                  )}
                </div>
                {b.distanceKm != null && (
                  <p className="text-sm font-semibold text-forest">
                    {b.distanceKm < 10
                      ? `${b.distanceKm.toFixed(1)} ק״מ`
                      : `${Math.round(b.distanceKm)} ק״מ`}
                  </p>
                )}
              </div>
              <span className={`badge mt-3 ${badge.cls}`}>{badge.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
