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
  url: string | null;
};

export type WalletSyncReport = {
  provider: WalletProviderId;
  status: "synced" | "login_required" | "error";
  upserted: number;
  /** Cards returned by the provider. Zero means the wallet call succeeded and was empty. */
  fetched?: number;
  error?: string;
};

export interface WalletProvider {
  readonly id: WalletProviderId;
  /** Pull + normalize using an already-authenticated session token. */
  sync(sessionToken: string): Promise<NormalizedWalletItem[]>;
}
