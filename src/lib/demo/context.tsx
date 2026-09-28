"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { buildDashboardSummary, filterVouchers } from "@/lib/calculations";
import type {
  ActivityEvent,
  DashboardSummary,
  Redemption,
  UserProfile,
  Voucher,
  VoucherFilters,
} from "@/lib/types";
import {
  addDemoRedemption,
  clearLastGain,
  deleteDemoVoucher,
  exportDemoJson,
  loadDemoState,
  resetDemoState,
  type DemoState,
  updateDemoProfile,
  upsertDemoVoucher,
  wipeDemoAccount,
} from "./store";

type DemoContextValue = {
  ready: boolean;
  profile: UserProfile;
  vouchers: Voucher[];
  redemptions: Redemption[];
  activity: ActivityEvent[];
  summary: DashboardSummary;
  lastGainAgorot: number | null;
  refresh: () => void;
  saveVoucher: (v: Voucher) => void;
  removeVoucher: (id: string) => void;
  redeem: (voucherId: string, amountAgorot: number, note: string | null) => void;
  setProfile: (patch: Partial<UserProfile>) => void;
  clearGain: () => void;
  reset: () => void;
  wipe: () => void;
  exportJson: () => string;
  filter: (filters: VoucherFilters) => Voucher[];
  getVoucher: (id: string) => Voucher | undefined;
  getRedemptions: (voucherId: string) => Redemption[];
};

const DemoContext = createContext<DemoContextValue | null>(null);

function subscribe(callback: () => void) {
  const handler = () => callback();
  window.addEventListener("zikuy-demo-updated", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("zikuy-demo-updated", handler);
    window.removeEventListener("storage", handler);
  };
}

function getSnapshot(): DemoState {
  return loadDemoState();
}

function getServerSnapshot(): DemoState {
  return {
    profile: {
      id: "demo-user",
      displayName: "דמו",
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
}

function subscribeReady(onStoreChange: () => void) {
  // Client hydration flips ready once; no further updates needed.
  queueMicrotask(onStoreChange);
  return () => {};
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribeReady,
    () => {
      loadDemoState();
      return true;
    },
    () => false,
  );

  const summary = useMemo(
    () => buildDashboardSummary(state.vouchers, state.activity),
    [state.vouchers, state.activity],
  );

  const refresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent("zikuy-demo-updated"));
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      ready,
      profile: state.profile,
      vouchers: state.vouchers,
      redemptions: state.redemptions,
      activity: state.activity,
      summary,
      lastGainAgorot: state.lastGainAgorot,
      refresh,
      saveVoucher: (v) => upsertDemoVoucher(v),
      removeVoucher: (id) => deleteDemoVoucher(id),
      redeem: (voucherId, amountAgorot, note) =>
        addDemoRedemption(voucherId, amountAgorot, note),
      setProfile: (patch) => updateDemoProfile(patch),
      clearGain: () => clearLastGain(),
      reset: () => resetDemoState(),
      wipe: () => wipeDemoAccount(),
      exportJson: () => exportDemoJson(),
      filter: (filters) => filterVouchers(state.vouchers, filters),
      getVoucher: (id) => state.vouchers.find((v) => v.id === id),
      getRedemptions: (voucherId) =>
        state.redemptions.filter((r) => r.voucherId === voucherId),
    }),
    [ready, state, summary, refresh],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
