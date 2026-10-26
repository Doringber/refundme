"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { User } from "@supabase/supabase-js";
import { buildDashboardSummary, filterVouchers } from "@/lib/calculations";
import { DEMO_COOKIE } from "@/lib/constants";
import { DemoProvider, useDemo } from "@/lib/demo/context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import type {
  ActivityEvent,
  DashboardSummary,
  Redemption,
  UserProfile,
  Voucher,
  VoucherFilters,
} from "@/lib/types";
import {
  addRedemption,
  createVoucher,
  deleteVoucher,
  exportUserJson,
  fetchActivity,
  fetchProfile,
  fetchRedemptions,
  fetchVouchers,
  getDocumentSignedUrl,
  updateProfile,
} from "@/lib/data/supabase-repo";

type AppDataValue = {
  mode: "demo" | "supabase";
  ready: boolean;
  user: User | null;
  profile: UserProfile;
  vouchers: Voucher[];
  redemptions: Redemption[];
  activity: ActivityEvent[];
  summary: DashboardSummary;
  lastGainAgorot: number | null;
  error: string | null;
  refresh: () => void;
  saveVoucher: (v: Voucher) => Promise<void> | void;
  removeVoucher: (id: string) => Promise<void> | void;
  redeem: (
    voucherId: string,
    amountAgorot: number,
    note: string | null,
  ) => Promise<void> | void;
  setProfile: (patch: Partial<UserProfile>) => Promise<void> | void;
  clearGain: () => void;
  reset: () => void;
  wipe: () => Promise<void> | void;
  exportJson: () => Promise<string> | string;
  filter: (filters: VoucherFilters) => Voucher[];
  getVoucher: (id: string) => Voucher | undefined;
  getRedemptions: (voucherId: string) => Redemption[];
  resolveDocumentUrl: (voucher: Voucher) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AppDataContext = createContext<AppDataValue | null>(null);

function readDemoCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim() === `${DEMO_COOKIE}=1`);
}

function subscribeDemoCookie(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 2000);
  window.addEventListener("focus", onStoreChange);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("focus", onStoreChange);
  };
}

function useDemoCookie(): boolean {
  return useSyncExternalStore(subscribeDemoCookie, readDemoCookie, () => false);
}

function defaultProfile(uid: string): UserProfile {
  return {
    id: uid,
    displayName: null,
    email: null,
    avatarUrl: null,
    orbScaleAgorot: 100000,
    reminderDays: [30, 14, 7, 3, 1],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function SupabaseAppProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [lastGainAgorot, setLastGainAgorot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (uid: string) => {
    const supabase = createClient();
    const [p, v, r, a] = await Promise.all([
      fetchProfile(supabase, uid),
      fetchVouchers(supabase, uid),
      fetchRedemptions(supabase, uid),
      fetchActivity(supabase, uid),
    ]);
    setProfileState(p ?? defaultProfile(uid));
    setVouchers(v);
    setRedemptions(r);
    setActivity(a);
  }, []);

  useEffect(() => {
    if (!configured) return;

    const supabase = createClient();
    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      if (data.user) {
        void loadAll(data.user.id)
          .catch((e: Error) => setError(e.message))
          .finally(() => {
            if (mounted) setReady(true);
          });
      } else {
        setReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (next) {
        void loadAll(next.id).catch((e: Error) => setError(e.message));
      } else {
        setVouchers([]);
        setRedemptions([]);
        setActivity([]);
        setProfileState(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [configured, loadAll]);

  const summary = useMemo(
    () => buildDashboardSummary(vouchers, activity),
    [vouchers, activity],
  );

  const value = useMemo<AppDataValue>(() => {
    const fallbackProfile = profile ?? defaultProfile(user?.id ?? "anon");
    return {
      mode: "supabase",
      ready,
      user,
      profile: fallbackProfile,
      vouchers,
      redemptions,
      activity,
      summary,
      lastGainAgorot,
      error,
      refresh: () => {
        if (user) void loadAll(user.id);
      },
      saveVoucher: async (v) => {
        if (!user) throw new Error("יש להתחבר כדי לשמור. חזרו להתחברות עם Google.");
        const supabase = createClient();
        const {
          data: { user: fresh },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !fresh) {
          throw new Error("הסשן פג — התחברו מחדש ואז שמרו שוב");
        }
        const withUser = { ...v, userId: fresh.id };
        try {
          const saved = await createVoucher(supabase, withUser);
          if (
            saved.documentType !== "receipt" &&
            saved.fieldsConfirmed &&
            saved.remainingAmountAgorot > 0
          ) {
            setLastGainAgorot(saved.remainingAmountAgorot);
          }
          await loadAll(fresh.id);
        } catch (err) {
          const message =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: string }).message)
              : err instanceof Error
                ? err.message
                : "השמירה נכשלה";
          throw new Error(message);
        }
      },
      removeVoucher: async (id) => {
        if (!user) return;
        const supabase = createClient();
        const existing = vouchers.find((x) => x.id === id);
        await deleteVoucher(supabase, user.id, id, existing?.documentPath ?? null);
        await loadAll(user.id);
      },
      redeem: async (voucherId, amountAgorot, note) => {
        if (!user) throw new Error("יש להתחבר");
        const voucher = vouchers.find((v) => v.id === voucherId);
        if (!voucher) throw new Error("המסמך לא נמצא");
        if (amountAgorot <= 0 || amountAgorot > voucher.remainingAmountAgorot) {
          throw new Error("סכום המימוש אינו תקין");
        }
        const supabase = createClient();
        await addRedemption(
          supabase,
          user.id,
          voucherId,
          amountAgorot,
          note,
          voucher.merchantName,
        );
        await loadAll(user.id);
      },
      setProfile: async (patch) => {
        if (!user) return;
        const supabase = createClient();
        const updated = await updateProfile(supabase, user.id, {
          ...fallbackProfile,
          ...patch,
        });
        setProfileState(updated);
      },
      clearGain: () => setLastGainAgorot(null),
      reset: () => {
        if (user) void loadAll(user.id);
      },
      wipe: async () => {
        const res = await fetch("/api/account/delete", { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "מחיקת החשבון נכשלה");
        }
        const supabase = createClient();
        await supabase.auth.signOut();
      },
      exportJson: async () => {
        if (!user) return "{}";
        const supabase = createClient();
        return exportUserJson(supabase, user.id);
      },
      filter: (filters) => filterVouchers(vouchers, filters),
      getVoucher: (id) => vouchers.find((v) => v.id === id),
      getRedemptions: (voucherId) =>
        redemptions.filter((r) => r.voucherId === voucherId),
      resolveDocumentUrl: async (voucher) => {
        if (voucher.documentDataUrl) return voucher.documentDataUrl;
        if (!voucher.documentPath) return null;
        const supabase = createClient();
        return getDocumentSignedUrl(supabase, voucher.documentPath);
      },
      signOut: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
      },
    };
  }, [
    ready,
    user,
    profile,
    vouchers,
    redemptions,
    activity,
    summary,
    lastGainAgorot,
    error,
    loadAll,
  ]);

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

function DemoAppBridge({ children }: { children: React.ReactNode }) {
  const demo = useDemo();
  const value = useMemo<AppDataValue>(
    () => ({
      mode: "demo",
      ready: demo.ready,
      user: null,
      profile: demo.profile,
      vouchers: demo.vouchers,
      redemptions: demo.redemptions,
      activity: demo.activity,
      summary: demo.summary,
      lastGainAgorot: demo.lastGainAgorot,
      error: null,
      refresh: demo.refresh,
      saveVoucher: (v) => {
        demo.saveVoucher(v);
      },
      removeVoucher: (id) => {
        demo.removeVoucher(id);
      },
      redeem: (voucherId, amountAgorot, note) => {
        demo.redeem(voucherId, amountAgorot, note);
      },
      setProfile: (patch) => {
        demo.setProfile(patch);
      },
      clearGain: demo.clearGain,
      reset: demo.reset,
      wipe: () => {
        demo.wipe();
      },
      exportJson: () => demo.exportJson(),
      filter: demo.filter,
      getVoucher: demo.getVoucher,
      getRedemptions: demo.getRedemptions,
      resolveDocumentUrl: async (voucher) => voucher.documentDataUrl,
      signOut: async () => undefined,
    }),
    [demo],
  );
  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function AppDataProvider({
  children,
  initialDemoCookie = false,
}: {
  children: React.ReactNode;
  /** From server cookies() so SSR matches client when demo cookie is set */
  initialDemoCookie?: boolean;
}) {
  const configured = isSupabaseConfigured();
  const liveDemoCookie = useDemoCookie();
  const demoCookie = initialDemoCookie || liveDemoCookie;
  const useDemoMode = !configured || demoCookie;

  if (useDemoMode) {
    return (
      <DemoProvider>
        <DemoAppBridge>{children}</DemoAppBridge>
      </DemoProvider>
    );
  }

  return <SupabaseAppProvider>{children}</SupabaseAppProvider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

function hardNavigate(path: string): void {
  // Full load so the server layout sees the demo cookie. A client router push
  // keeps the previous RSC payload and the mode does not switch.
  const destination = new URL(path, window.location.origin);
  window.location.assign(destination.href);
}

/** Enter demo mode explicitly (sets cookie) and reloads into demo store */
export function enterDemoMode(): void {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
  hardNavigate("/dashboard");
}

export function exitDemoMode(): void {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
  hardNavigate("/");
}
