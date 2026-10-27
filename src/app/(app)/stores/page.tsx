"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { LoadingBlock } from "@/components/ui/loading";
import { useAppData } from "@/lib/app-data/context";
import { formatIls } from "@/lib/calculations";
import { DEMO_BRANCHES, DEMO_MERCHANTS } from "@/lib/demo/data";
import { createClient } from "@/lib/supabase/client";
import {
  compareByNearest,
  foldSearchText,
  geolocationErrorMessage,
  readStoredOrigin,
  rowMatchesFilter,
  writeStoredOrigin,
  type SearchOrigin,
} from "@/lib/stores/client-location";
import { catalogForVoucher } from "@/lib/stores/lookup";
import {
  formatDistanceKm,
  haversineKm,
  isRedeemableVoucher,
  voucherMatchesBranch,
} from "@/lib/stores/nearby";
import { MAX_PLACE_KM, parseNearbyPayload, type NearbyPayload } from "@/lib/stores/search";
import type { MerchantBranch, Voucher } from "@/lib/types";

type LookupState = Omit<NearbyPayload, "status"> & {
  status: NearbyPayload["status"] | "loading";
};

/** The route answers within ~8.5s; past this the platform has failed it. */
const LOOKUP_TIMEOUT_MS = 9_500;
const LIST_WITHOUT_LOCATION = 4;

const UNAVAILABLE: LookupState = {
  label: null,
  brandCount: null,
  places: [],
  status: "places_unavailable",
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

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

async function fetchLookup(url: string, init?: RequestInit): Promise<LookupState> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    const contentType = res.headers.get("content-type");
    const body = contentType?.includes("json") ? await res.json() : null;
    return parseNearbyPayload({ contentType, body });
  } catch {
    return UNAVAILABLE;
  }
}

/** One request for every BuyMe card: the server shares one map query between them. */
async function fetchCatalogs(
  origin: SearchOrigin,
  ids: string[],
): Promise<Record<string, LookupState>> {
  const results: Record<string, LookupState> = {};
  try {
    const res = await fetch("/api/stores/nearby", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lat: origin.lat, lng: origin.lng, catalogIds: ids }),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    const contentType = res.headers.get("content-type");
    const body = (contentType?.includes("json") ? await res.json() : null) as {
      catalogs?: Record<string, unknown>;
    } | null;
    for (const id of ids) {
      results[id] = parseNearbyPayload({ contentType, body: body?.catalogs?.[id] });
    }
  } catch {
    for (const id of ids) results[id] = UNAVAILABLE;
  }
  return results;
}

function postMerchant(origin: SearchOrigin, merchantName: string): Promise<LookupState> {
  return fetchLookup("/api/stores/nearby", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lat: origin.lat, lng: origin.lng, merchantName }),
  });
}

type Row = { key: string; name: string; detail: string; distanceKm: number | null };

export default function StoresPage() {
  const app = useAppData();
  const [query, setQuery] = useState("");
  const [origin, setOriginState] = useState<SearchOrigin | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  /** False until a remembered or already-permitted location has been tried. */
  const [originSettled, setOriginSettled] = useState(false);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [remoteBranches, setRemoteBranches] = useState<MerchantBranch[] | null>(null);
  const [remoteFor, setRemoteFor] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const userId = app.mode === "supabase" ? (app.user?.id ?? null) : null;

  const spendable = useMemo(
    () => app.vouchers.filter(isRedeemableVoucher),
    [app.vouchers],
  );
  const targetsKey = useMemo(() => {
    const catalogs = new Set<string>();
    const merchants = new Set<string>();
    for (const voucher of spendable) {
      const catalog = catalogForVoucher(voucher);
      if (catalog) catalogs.add(catalog.id);
      else merchants.add(voucher.merchantName);
    }
    return JSON.stringify([[...catalogs].sort(), [...merchants].sort()]);
  }, [spendable]);
  const targets = useMemo(() => {
    const [catalogIds, merchants] = JSON.parse(targetsKey) as [string[], string[]];
    return { catalogIds, merchants };
  }, [targetsKey]);

  const setOrigin = useCallback((next: SearchOrigin | null) => {
    setOriginState(next);
    writeStoredOrigin(sessionStore(), next);
  }, []);

  const requestLocation = useCallback(() => {
    setLocError(null);
    if (!window.isSecureContext) {
      setLocError(geolocationErrorMessage("insecure"));
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocError(geolocationErrorMessage("unsupported"));
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "device",
          label: null,
        });
        setLocBusy(false);
        setOriginSettled(true);
      },
      (err) => {
        setLocError(geolocationErrorMessage(err.code));
        setLocBusy(false);
        setOriginSettled(true);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  }, [setOrigin]);

  // Returning to the page keeps the place from this session; a site that
  // already has location permission gets a fresh fix without a tap.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const stored = readStoredOrigin(sessionStore());
      if (stored) {
        setOriginState(stored);
        setOriginSettled(true);
        return;
      }
      try {
        const permission = await navigator.permissions?.query({ name: "geolocation" });
        if (!cancelled && permission?.state === "granted" && window.isSecureContext) {
          requestLocation();
          return;
        }
      } catch {
        /* Permissions API missing (older Safari): wait for the button */
      }
      if (!cancelled) setOriginSettled(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestLocation]);

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

  // Each lookup paints its card as soon as it answers.
  useEffect(() => {
    const { catalogIds, merchants } = targets;
    if (!originSettled || (!catalogIds.length && !merchants.length)) return;
    let cancelled = false;
    const put = (key: string, value: LookupState) => {
      if (!cancelled) setLookups((current) => ({ ...current, [key]: value }));
    };
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const keys = [
        ...catalogIds.map((id) => `catalog:${id}`),
        ...merchants.map((name) => `merchant:${name}`),
      ];
      setLookups((current) => {
        const next = { ...current };
        // Rows from another origin would show wrong distances while loading.
        for (const key of keys) {
          next[key] = { ...(current[key] ?? UNAVAILABLE), places: [], status: "loading" };
        }
        return next;
      });
      const jobs: Promise<void>[] = [];
      if (catalogIds.length) {
        if (origin) {
          jobs.push(
            fetchCatalogs(origin, catalogIds).then((results) => {
              for (const id of catalogIds) put(`catalog:${id}`, results[id] ?? UNAVAILABLE);
            }),
          );
        } else {
          for (const id of catalogIds) {
            jobs.push(
              fetchLookup(`/api/stores/nearby?id=${id}`).then((result) =>
                put(`catalog:${id}`, result),
              ),
            );
          }
        }
      }
      merchants.forEach((name, index) => {
        jobs.push(
          (async () => {
            if (index > 0) await new Promise((resolve) => setTimeout(resolve, index * 150));
            if (cancelled) return;
            const result = origin
              ? await postMerchant(origin, name)
              : await fetchLookup(`/api/stores/nearby?merchant=${encodeURIComponent(name)}`);
            put(`merchant:${name}`, result);
          })(),
        );
      });
      await Promise.all(jobs);
    })();
    return () => {
      cancelled = true;
    };
  }, [targets, origin, originSettled, retry]);

  async function searchNearTypedPlace(event?: React.FormEvent) {
    event?.preventDefault();
    const text = query.trim();
    if (text.length < 2 || placeBusy) return;
    setPlaceBusy(true);
    setLocError(null);
    try {
      const res = await fetch(`/api/stores/nearby?place=${encodeURIComponent(text)}`, {
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      });
      const body = (await res.json()) as {
        status?: string;
        lat?: number;
        lng?: number;
        label?: string;
      };
      if (body.status === "ok" && typeof body.lat === "number" && typeof body.lng === "number") {
        setOrigin({ lat: body.lat, lng: body.lng, source: "place", label: body.label ?? text });
        setQuery("");
      } else {
        setLocError(`לא מצאנו מקום בשם „${text}”. נסו שם עיר, או רחוב ועיר.`);
      }
    } catch {
      setLocError("החיפוש לפי מקום לא הגיב. נסו שוב בעוד רגע.");
    } finally {
      setPlaceBusy(false);
    }
  }

  const sourceBranches = useMemo(() => {
    if (app.mode !== "supabase") return DEMO_BRANCHES;
    if (!userId || remoteFor !== userId) return [];
    return remoteBranches ?? [];
  }, [app.mode, userId, remoteBranches, remoteFor]);
  const demoNames = useMemo(
    () => new Map(DEMO_MERCHANTS.map((merchant) => [merchant.id, merchant.nameHe])),
    [],
  );

  const waitingForBranches = Boolean(userId) && remoteFor !== userId;
  if (!app.ready || waitingForBranches) return <LoadingBlock label="פותחים את המפה…" />;

  const needle = query.trim();
  const fromLabel = origin?.source === "place" ? (origin.label ?? "המקום שבחרתם") : null;

  const cards = spendable.map((voucher, index) => {
    const catalog = catalogForVoucher(voucher);
    const key = lookupKey(voucher);
    const lookup = lookups[key];
    const local = catalog
      ? []
      : sourceBranches
          .filter(
            (branch) =>
              branch.acceptance !== "not_accepted" &&
              voucherMatchesBranch(voucher, {
                ...branch,
                merchantNameHe:
                  branch.merchantNameHe ?? demoNames.get(branch.merchantId) ?? undefined,
              }),
          )
          .map((branch) => ({
            ...branch,
            distanceKm:
              origin && branch.lat != null && branch.lng != null
                ? haversineKm(origin.lat, origin.lng, branch.lat, branch.lng)
                : null,
          }))
          .filter((branch) => branch.distanceKm == null || branch.distanceKm <= MAX_PLACE_KM);

    const merchantFold = foldSearchText(voucher.merchantName);
    const remote = (lookup?.places ?? []).filter(
      // Without a location, a bare chain name with no address tells nothing.
      (place) =>
        origin != null ||
        place.address != null ||
        foldSearchText(place.name) !== merchantFold,
    );
    const seen = new Set<string>();
    const allRows: Row[] = [
      ...local.map((branch) => ({
        key: branch.id,
        name: branch.nameHe,
        detail: [branch.city, branch.addressHe].filter(Boolean).join(" · "),
        distanceKm: branch.distanceKm,
      })),
      ...remote.map((place, placeIndex) => ({
        key: `osm-${place.name}-${placeIndex}`,
        name: place.name,
        detail: place.address ?? (origin ? "כתובת לא פורסמה במפה" : ""),
        distanceKm: place.distanceKm,
      })),
    ]
      .filter((row) => {
        const stamp = `${foldSearchText(row.name)}:${row.distanceKm == null ? "x" : Math.round(row.distanceKm * 5)}`;
        if (seen.has(stamp)) return false;
        seen.add(stamp);
        return true;
      })
      .sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY),
      );
    const nameMatches = needle ? rowMatchesFilter({ name: voucher.merchantName, detail: "" }, needle) : true;
    const filtered = needle && !nameMatches
      ? allRows.filter((row) => rowMatchesFilter(row, needle))
      : allRows;
    const rows = origin ? filtered : filtered.slice(0, LIST_WITHOUT_LOCATION);
    return {
      voucher,
      catalog,
      lookup,
      rows,
      knownCount: allRows.length,
      hidden: Boolean(needle) && !nameMatches && filtered.length === 0,
      nearestKm: rows[0]?.distanceKm ?? null,
      index,
    };
  });
  const visibleCards = cards
    .filter((card) => !card.hidden)
    .sort(compareByNearest);
  const anyLoading = cards.some((card) => card.lookup?.status === "loading");

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-forest">איפה לממש</h1>
          <p className="mt-3 max-w-sm text-sm font-semibold text-eggplant">
            רק בתי עסק שמתאימים לזיכויים שלכם. המיקום לא נשמר אצלנו.
          </p>
        </div>
        <BagMascot mood={origin ? "walk" : "happy"} className="h-28 w-28 shrink-0" />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          className="btn-primary w-full text-base"
          onClick={requestLocation}
          disabled={locBusy}
          aria-busy={locBusy}
        >
          {locBusy
            ? "מאתרים מיקום…"
            : origin?.source === "device"
              ? "עדכון המיקום"
              : "הצגת בתי עסק קרובים"}
        </button>
        {origin && (
          <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <p className="font-bold text-eggplant" role="status">
              {fromLabel ? `מחפשים ליד ${fromLabel}` : "מחפשים לפי המיקום שלכם"}
            </p>
            <button
              type="button"
              className="min-h-11 shrink-0 font-bold text-eggplant underline"
              onClick={() => setOrigin(null)}
            >
              בלי מיקום
            </button>
          </div>
        )}
        {locError && (
          <p className="text-sm font-bold text-[#a33a28]" role="alert">
            {locError}
          </p>
        )}
        <form className="space-y-2" onSubmit={(event) => void searchNearTypedPlace(event)}>
          <label className="block text-sm">
            <span className="sr-only">סינון לפי שם בית עסק או כתובת</span>
            <input
              className="input-field"
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="שם בית עסק או כתובת"
            />
          </label>
          {needle.length >= 2 && (
            <button
              type="submit"
              className="min-h-11 w-full text-sm font-bold text-forest underline"
              disabled={placeBusy}
              aria-busy={placeBusy}
            >
              {placeBusy ? "מחפשים את המקום…" : `חיפוש בתי עסק ליד „${needle}”`}
            </button>
          )}
        </form>
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
      ) : visibleCards.length === 0 ? (
        <p className="text-sm font-semibold text-eggplant" role="status">
          {anyLoading
            ? "מחפשים…"
            : `אף בית עסק שנמצא לא מתאים ל„${needle}”. אפשר לחפש ליד המקום הזה בכפתור למעלה.`}
        </p>
      ) : (
        <div className="stagger-list space-y-4">
          {visibleCards.map(({ voucher, catalog, lookup, rows, knownCount }) => (
            <section key={voucher.id} className="ticket-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl leading-none break-words text-forest">
                    {voucher.merchantName}
                  </h2>
                  <p className="mt-2 text-sm font-bold text-eggplant">
                    נשאר {formatIls(voucher.remainingAmountAgorot)}
                  </p>
                </div>
                <Link
                  href={`/vouchers/${voucher.id}`}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-extrabold text-forest underline"
                >
                  לשובר
                </Link>
              </div>
              <VoucherNote
                catalog={Boolean(catalog)}
                merchantName={voucher.merchantName}
                lookup={lookup}
                origin={origin}
                fromLabel={fromLabel}
                rowCount={rows.length}
                knownCount={knownCount}
                onRetry={() => setRetry((count) => count + 1)}
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
                      <div className="min-w-0">
                        <p className="font-extrabold break-words text-night">{row.name}</p>
                        {row.detail && (
                          <p className="text-sm break-words text-eggplant">{row.detail}</p>
                        )}
                      </div>
                      {row.distanceKm != null && (
                        <p className="shrink-0 rounded-full bg-[var(--butter)] px-2 py-1 text-sm font-extrabold text-[#1c1c1c]">
                          {formatDistanceKm(row.distanceKm)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      className="ms-1 inline-flex min-h-11 items-center font-bold text-forest underline"
      onClick={onRetry}
    >
      לנסות שוב
    </button>
  );
}

function VoucherNote({
  catalog,
  merchantName,
  lookup,
  origin,
  fromLabel,
  rowCount,
  knownCount,
  onRetry,
}: {
  catalog: boolean;
  merchantName: string;
  lookup: LookupState | undefined;
  origin: SearchOrigin | null;
  fromLabel: string | null;
  rowCount: number;
  knownCount: number;
  onRetry: () => void;
}) {
  const fromWhere = fromLabel ? `מ${fromLabel}` : "אליכם";
  const radius = lookup?.radiusKm ?? MAX_PLACE_KM;
  if (lookup?.status === "loading" && rowCount === 0) {
    return (
      <p className="text-sm text-eggplant" role="status">
        {origin ? "מחפשים בתי עסק על המפה…" : "טוענים…"}
      </p>
    );
  }
  if (catalog) {
    if (!lookup) {
      return <p className="text-sm text-eggplant">טוענים את רשימת בתי העסק של BuyMe…</p>;
    }
    if (lookup.status === "catalog_unavailable") {
      return (
        <p className="text-sm text-eggplant" role="status">
          לא הצלחנו לטעון את הרשימה הציבורית של BuyMe לשובר הזה.
          <RetryButton onRetry={onRetry} />
        </p>
      );
    }
    if (!origin) {
      return (
        <p className="text-sm text-eggplant">
          BuyMe מפרסם {lookup.brandCount ?? "רשימת"} בתי עסק שמקבלים את{" "}
          {lookup.label ?? merchantName}. אשרו מיקום או הקלידו עיר כדי לראות מה קרוב.
        </p>
      );
    }
    if (lookup.status === "places_unavailable" && rowCount === 0) {
      return (
        <p className="text-sm text-eggplant" role="status">
          הרשימה כוללת {lookup.brandCount ?? "כמה"} בתי עסק, אבל המפה הפתוחה לא הגיבה בזמן.
          <RetryButton onRetry={onRetry} />
        </p>
      );
    }
    if (rowCount === 0) {
      return (
        <p className="text-sm text-eggplant">
          לא נמצא בטווח {radius} ק״מ בית עסק מתוך {lookup.brandCount ?? "רשימת"} בתי העסק.
          ההתאמה היא לפי שם מול המפה הפתוחה, ולא כל סניף מסומן בה.
        </p>
      );
    }
    return (
      <p className="text-sm text-eggplant">
        בתי עסק מהרשימה של {lookup.label ?? merchantName}, לפי המרחק {fromWhere}.
      </p>
    );
  }

  if (!origin) {
    if (rowCount > 0) {
      return (
        <p className="text-sm text-eggplant">
          {knownCount > rowCount
            ? `${knownCount} סניפים ידועים, הנה חלק מהם.`
            : "סניפים ידועים."}{" "}
          אשרו מיקום או הקלידו עיר כדי לראות מה הכי קרוב.
        </p>
      );
    }
    return (
      <p className="text-sm text-eggplant">
        אשרו מיקום או הקלידו עיר, ונחפש סניפים של {merchantName} בסביבה.
      </p>
    );
  }
  if (lookup?.status === "places_unavailable" && rowCount === 0) {
    return (
      <p className="text-sm text-eggplant" role="status">
        המפה הפתוחה לא הגיבה בזמן עבור {merchantName}. לא מציגים רשת אחרת.
        <RetryButton onRetry={onRetry} />
      </p>
    );
  }
  if (rowCount === 0) {
    return (
      <p className="text-sm text-eggplant">
        לא נמצאו סניפים של {merchantName} בטווח {radius} ק״מ.
      </p>
    );
  }
  return (
    <p className="text-sm text-eggplant">
      סניפים של {merchantName} לפי המרחק {fromWhere}.
    </p>
  );
}
