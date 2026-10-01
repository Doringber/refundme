"use client";

import { DEMO_STORAGE_KEY } from "../constants";
import type {
  ActivityEvent,
  Redemption,
  UserProfile,
  Voucher,
} from "../types";
import { createDemoSeed, DEMO_USER_ID } from "./data";

export interface DemoState {
  profile: UserProfile;
  vouchers: Voucher[];
  redemptions: Redemption[];
  activity: ActivityEvent[];
  lastGainAgorot: number | null;
}

const listeners = new Set<() => void>();

let cachedClientState: DemoState | null = null;
let cachedSerialized: string | null = null;

/** Stable server snapshot — must be referentially identical across calls */
export const SERVER_DEMO_SNAPSHOT: DemoState = {
  profile: {
    id: "demo-user",
    displayName: "דור",
    email: null,
    avatarUrl: null,
    orbScaleAgorot: 100000,
    reminderDays: [30, 14, 7, 3, 1],
    createdAt: "",
    updatedAt: "",
  },
  vouchers: [],
  redemptions: [],
  activity: [],
  lastGainAgorot: null,
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribeDemoStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerDemoSnapshot(): DemoState {
  return SERVER_DEMO_SNAPSHOT;
}

export function getClientDemoSnapshot(): DemoState {
  if (!canUseStorage()) return SERVER_DEMO_SNAPSHOT;

  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const seed = createDemoSeed();
      const state: DemoState = { ...seed, lastGainAgorot: null };
      const serialized = JSON.stringify(state);
      localStorage.setItem(DEMO_STORAGE_KEY, serialized);
      cachedClientState = state;
      cachedSerialized = serialized;
      return state;
    }
    if (raw === cachedSerialized && cachedClientState) {
      return cachedClientState;
    }
    const parsed = JSON.parse(raw) as DemoState;
    cachedClientState = parsed;
    cachedSerialized = raw;
    return parsed;
  } catch {
    const seed = createDemoSeed();
    const state: DemoState = { ...seed, lastGainAgorot: null };
    cachedClientState = state;
    cachedSerialized = JSON.stringify(state);
    return state;
  }
}

/** @deprecated use getClientDemoSnapshot — kept for call sites */
export function loadDemoState(): DemoState {
  return getClientDemoSnapshot();
}

export function saveDemoState(state: DemoState): void {
  if (!canUseStorage()) return;
  const serialized = JSON.stringify(state);
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, serialized);
    cachedClientState = state;
    cachedSerialized = serialized;
  } catch {
    // QuotaExceeded — strip bulky data URLs and retry once
    const slim: DemoState = {
      ...state,
      vouchers: state.vouchers.map((v) => ({
        ...v,
        documentDataUrl:
          v.documentDataUrl && v.documentDataUrl.length > 80_000
            ? null
            : v.documentDataUrl,
      })),
    };
    try {
      const slimSerialized = JSON.stringify(slim);
      localStorage.setItem(DEMO_STORAGE_KEY, slimSerialized);
      cachedClientState = slim;
      cachedSerialized = slimSerialized;
    } catch {
      throw new Error(
        "אין מספיק מקום לשמור את התמונה במכשיר. התחברו לחשבון לשמירה בענן, או העלו תמונה קטנה יותר.",
      );
    }
  }
  notify();
  window.dispatchEvent(new CustomEvent("zikuy-demo-updated"));
}

export function resetDemoState(): DemoState {
  const seed = createDemoSeed();
  const state: DemoState = { ...seed, lastGainAgorot: null };
  saveDemoState(state);
  return state;
}

export function clearLastGain(): void {
  const state = { ...getClientDemoSnapshot(), lastGainAgorot: null };
  saveDemoState(state);
}

export function upsertDemoVoucher(voucher: Voucher): DemoState {
  const prev = getClientDemoSnapshot();
  const state: DemoState = {
    ...prev,
    vouchers: [...prev.vouchers],
    activity: [...prev.activity],
  };
  const idx = state.vouchers.findIndex((v) => v.id === voucher.id);
  const isNew = idx === -1;
  if (isNew) {
    state.vouchers = [voucher, ...state.vouchers];
    if (
      voucher.documentType !== "receipt" &&
      voucher.fieldsConfirmed &&
      voucher.remainingAmountAgorot > 0
    ) {
      state.lastGainAgorot = voucher.remainingAmountAgorot;
    }
    state.activity = [
      {
        id: crypto.randomUUID(),
        userId: DEMO_USER_ID,
        voucherId: voucher.id,
        kind: "created",
        summaryHe:
          voucher.documentType === "receipt"
            ? `נשמרה קבלה מ${voucher.merchantName} (לא נספרת כזיכוי)`
            : `נוסף מסמך מ${voucher.merchantName}`,
        metadata: { amountAgorot: voucher.remainingAmountAgorot },
        createdAt: new Date().toISOString(),
      },
      ...state.activity,
    ];
  } else {
    state.vouchers[idx] = voucher;
  }
  saveDemoState(state);
  return state;
}

export function deleteDemoVoucher(id: string): DemoState {
  const prev = getClientDemoSnapshot();
  const state: DemoState = {
    ...prev,
    vouchers: prev.vouchers.filter((v) => v.id !== id),
    redemptions: prev.redemptions.filter((r) => r.voucherId !== id),
    activity: prev.activity.filter((a) => a.voucherId !== id),
  };
  saveDemoState(state);
  return state;
}

export function addDemoRedemption(
  voucherId: string,
  amountAgorot: number,
  note: string | null,
): DemoState {
  const prev = getClientDemoSnapshot();
  const voucher = prev.vouchers.find((v) => v.id === voucherId);
  if (!voucher) return prev;
  if (amountAgorot <= 0 || amountAgorot > voucher.remainingAmountAgorot) {
    throw new Error("סכום המימוש אינו תקין");
  }

  const redemption: Redemption = {
    id: crypto.randomUUID(),
    voucherId,
    userId: DEMO_USER_ID,
    amountAgorot,
    redeemedAt: new Date().toISOString().slice(0, 10),
    note,
    createdAt: new Date().toISOString(),
  };

  const redemptions = [redemption, ...prev.redemptions];
  const spent = redemptions
    .filter((r) => r.voucherId === voucherId)
    .reduce((s, r) => s + r.amountAgorot, 0);
  const remaining = Math.max(0, voucher.originalAmountAgorot - spent);
  const updated: Voucher = {
    ...voucher,
    remainingAmountAgorot: remaining,
    status: remaining === 0 ? "fully_redeemed" : "partially_redeemed",
    updatedAt: new Date().toISOString(),
  };

  const state: DemoState = {
    ...prev,
    vouchers: prev.vouchers.map((v) => (v.id === voucherId ? updated : v)),
    redemptions,
    activity: [
      {
        id: crypto.randomUUID(),
        userId: DEMO_USER_ID,
        voucherId,
        kind: "redemption",
        summaryHe: `מימוש של ₪${(amountAgorot / 100).toLocaleString("he-IL")} ב${voucher.merchantName}`,
        metadata: { amountAgorot },
        createdAt: new Date().toISOString(),
      },
      ...prev.activity,
    ],
  };

  saveDemoState(state);
  return state;
}

export function updateDemoProfile(patch: Partial<UserProfile>): DemoState {
  const prev = getClientDemoSnapshot();
  const state: DemoState = {
    ...prev,
    profile: {
      ...prev.profile,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
  saveDemoState(state);
  return state;
}

export function exportDemoJson(): string {
  const state = getClientDemoSnapshot();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      balanceLabel: "יתרה לפי הדיווח שלך",
      profile: state.profile,
      vouchers: state.vouchers,
      redemptions: state.redemptions,
      activity: state.activity,
    },
    null,
    2,
  );
}

export function wipeDemoAccount(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(DEMO_STORAGE_KEY);
  cachedClientState = null;
  cachedSerialized = null;
  notify();
}
