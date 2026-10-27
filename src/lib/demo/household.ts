"use client";

import type { HouseholdSnapshot } from "@/lib/types";

const KEY = "zikuy_sheli_household_v1";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSnapshot: HouseholdSnapshot | null = null;

type StoredInvite = {
  id: string;
  email: string | null;
  token: string;
  expiresAt: string;
};

type StoredHousehold = {
  id: string;
  name: string;
  invites: StoredInvite[];
};

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeDemoHousehold(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readDemoHousehold(): HouseholdSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = null;
    return null;
  }
  try {
    const stored = JSON.parse(raw) as StoredHousehold;
    if (!stored?.id) {
      cachedSnapshot = null;
      return null;
    }
    cachedSnapshot = {
      id: stored.id,
      name: stored.name || "הבית",
      role: "owner",
      members: [
        {
          userId: "demo-user",
          role: "owner",
          displayName: "דור",
          email: null,
        },
      ],
      invites: (stored.invites ?? []).map((invite) => ({
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
      })),
    };
    return cachedSnapshot;
  } catch {
    cachedSnapshot = null;
    return null;
  }
}

function write(stored: StoredHousehold | null): void {
  if (stored) window.localStorage.setItem(KEY, JSON.stringify(stored));
  else window.localStorage.removeItem(KEY);
  notify();
}

function readStored(): StoredHousehold | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredHousehold;
  } catch {
    return null;
  }
}

export function createDemoHousehold(name: string): void {
  write({
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 40) || "הבית",
    invites: [],
  });
}

export function inviteDemoHousehold(email: string): { url: string } {
  const current = readStored() ?? {
    id: crypto.randomUUID(),
    name: "הבית",
    invites: [],
  };
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const invite: StoredInvite = {
    id: crypto.randomUUID(),
    email: email.trim() ? email.trim().toLowerCase() : null,
    token,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  };
  write({ ...current, invites: [invite, ...current.invites] });
  return { url: `${window.location.origin}/join/${token}` };
}

export function revokeDemoInvite(id: string): void {
  const current = readStored();
  if (!current) return;
  write({ ...current, invites: current.invites.filter((invite) => invite.id !== id) });
}

export function leaveDemoHousehold(): void {
  write(null);
}
