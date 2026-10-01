/** Same shape for every provider — the app does not care about the source. */
export type WalletProviderId = "buyme";

export type NormalizedWalletItem = {
  provider: WalletProviderId;
  externalId: string;
  merchant: string;
  originalValueShekels: number;
  remainingValueShekels: number;
  expiresAt: string | null;
  status: "active" | "used" | "expired";
  code: string | null;
  barcode: string | null;
};

export type WalletSyncReport = {
  provider: WalletProviderId;
  status: "synced" | "login_required" | "error";
  upserted: number;
  error?: string;
};

export interface WalletProvider {
  readonly id: WalletProviderId;
  /** Pull + normalize using an already-authenticated session token. */
  sync(sessionToken: string): Promise<NormalizedWalletItem[]>;
}
