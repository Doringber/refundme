"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { buildDashboardSummary, filterVouchers } from "@/lib/calculations";
import { DEMO_STORAGE_KEY } from "@/lib/constants";
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
  getClientDemoSnapshot,
  getServerDemoSnapshot,
  resetDemoState,
  subscribeDemoStore,
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
  const unsub = subscribeDemoStore(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === DEMO_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    unsub();
    window.removeEventListener("storage", onStorage);
  };
}

function getReadySnapshot(): boolean {
  return true;
}

function getReadyServerSnapshot(): boolean {
  return false;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(
    subscribe,
    getClientDemoSnapshot,
    getServerDemoSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribe,
    getReadySnapshot,
    getReadyServerSnapshot,
  );

  const summary = useMemo(
    () => buildDashboardSummary(state.vouchers, state.activity),
    [state.vouchers, state.activity],
  );

  const refresh = useCallback(() => {
    // Force re-read by notifying subscribers after a no-op write of same cache
    getClientDemoSnapshot();
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
      saveVoucher: (v) => {
        upsertDemoVoucher(v);
      },
      removeVoucher: (id) => {
        deleteDemoVoucher(id);
      },
      redeem: (voucherId, amountAgorot, note) => {
        addDemoRedemption(voucherId, amountAgorot, note);
      },
      setProfile: (patch) => {
        updateDemoProfile(patch);
      },
      clearGain: () => {
        clearLastGain();
      },
      reset: () => {
        resetDemoState();
      },
      wipe: () => {
        wipeDemoAccount();
        resetDemoState();
      },
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
