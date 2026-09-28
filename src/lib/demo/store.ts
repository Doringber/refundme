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

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadDemoState(): DemoState {
  if (!canUseStorage()) {
    return { ...createDemoSeed(), lastGainAgorot: null };
  }
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const seed = createDemoSeed();
      const state: DemoState = { ...seed, lastGainAgorot: null };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
      return state;
    }
    return JSON.parse(raw) as DemoState;
  } catch {
    const seed = createDemoSeed();
    return { ...seed, lastGainAgorot: null };
  }
}

export function saveDemoState(state: DemoState): void {
  if (!canUseStorage()) return;
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("zikuy-demo-updated"));
}

export function resetDemoState(): DemoState {
  const seed = createDemoSeed();
  const state: DemoState = { ...seed, lastGainAgorot: null };
  saveDemoState(state);
  return state;
}

export function clearLastGain(): void {
  const state = loadDemoState();
  state.lastGainAgorot = null;
  saveDemoState(state);
}

export function upsertDemoVoucher(voucher: Voucher): DemoState {
  const state = loadDemoState();
  const idx = state.vouchers.findIndex((v) => v.id === voucher.id);
  const isNew = idx === -1;
  if (isNew) {
    state.vouchers.unshift(voucher);
    if (
      voucher.documentType !== "receipt" &&
      voucher.fieldsConfirmed &&
      voucher.remainingAmountAgorot > 0
    ) {
      state.lastGainAgorot = voucher.remainingAmountAgorot;
    }
    state.activity.unshift({
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
    });
  } else {
    state.vouchers[idx] = voucher;
  }
  saveDemoState(state);
  return state;
}

export function deleteDemoVoucher(id: string): DemoState {
  const state = loadDemoState();
  state.vouchers = state.vouchers.filter((v) => v.id !== id);
  state.redemptions = state.redemptions.filter((r) => r.voucherId !== id);
  state.activity = state.activity.filter((a) => a.voucherId !== id);
  saveDemoState(state);
  return state;
}

export function addDemoRedemption(
  voucherId: string,
  amountAgorot: number,
  note: string | null,
): DemoState {
  const state = loadDemoState();
  const voucher = state.vouchers.find((v) => v.id === voucherId);
  if (!voucher) return state;
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
  state.redemptions.unshift(redemption);

  const spent = state.redemptions
    .filter((r) => r.voucherId === voucherId)
    .reduce((s, r) => s + r.amountAgorot, 0);
  voucher.remainingAmountAgorot = Math.max(
    0,
    voucher.originalAmountAgorot - spent,
  );
  voucher.status =
    voucher.remainingAmountAgorot === 0
      ? "fully_redeemed"
      : "partially_redeemed";
  voucher.updatedAt = new Date().toISOString();

  state.activity.unshift({
    id: crypto.randomUUID(),
    userId: DEMO_USER_ID,
    voucherId,
    kind: "redemption",
    summaryHe: `מימוש של ₪${(amountAgorot / 100).toLocaleString("he-IL")} ב${voucher.merchantName}`,
    metadata: { amountAgorot },
    createdAt: new Date().toISOString(),
  });

  saveDemoState(state);
  return state;
}

export function updateDemoProfile(patch: Partial<UserProfile>): DemoState {
  const state = loadDemoState();
  state.profile = {
    ...state.profile,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveDemoState(state);
  return state;
}

export function exportDemoJson(): string {
  const state = loadDemoState();
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
}
