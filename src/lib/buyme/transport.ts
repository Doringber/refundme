import { ReauthenticationRequired, UpstreamError } from "./errors";
import type { BuyMeSession } from "./session";
import { isSessionExpired } from "./session";

/**
 * Cookie-less HTTPS transport for BuyMe's private `/siteapi` (Bearer JWT).
 * Shape inspired by maccabi-health `MaccabiTransport`:
 * - allowlisted origin only
 * - hard timeouts
 * - 401/403 → clear auth / reauth required
 * - never accept caller-supplied Authorization that bypasses the jar/session
 */

export const BUYME_ORIGIN = "https://buyme.co.il";

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type BuyMeTransportOptions = {
  fetch?: FetchFunction;
  session?: BuyMeSession;
  timeoutMs?: number;
  userAgent?: string;
};

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

export async function abortable<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

export class BuyMeTransport {
  readonly #fetch: FetchFunction;
  readonly #timeoutMs: number;
  readonly #userAgent: string;
  #session: BuyMeSession | null;

  constructor(options: BuyMeTransportOptions = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#userAgent = options.userAgent ?? DEFAULT_UA;
    this.#session = options.session ?? null;
  }

  get session(): BuyMeSession | null {
    return this.#session;
  }

  setSession(session: BuyMeSession | null): void {
    this.#session = session;
  }

  clearSession(): void {
    this.#session = null;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.#session?.token) throw new ReauthenticationRequired();
    if (isSessionExpired(this.#session)) {
      this.clearSession();
      throw new ReauthenticationRequired("token expired");
    }

    const url = this.#checkedUrl(path);
    const headers = new Headers(init.headers);
    headers.delete("authorization");
    headers.delete("cookie");
    headers.set("Authorization", `Bearer ${this.#session.token}`);
    headers.set("Accept", "application/json");
    if (!headers.has("User-Agent")) headers.set("User-Agent", this.#userAgent);

    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;

    let response: Response;
    try {
      response = await abortable(
        this.#fetch(url.href, {
          ...init,
          headers,
          redirect: "error",
          signal,
        }),
        signal,
      );
    } catch {
      throw new UpstreamError(
        timeout.aborted ? "REQUEST_TIMEOUT" : signal.aborted ? "REQUEST_ABORTED" : "NETWORK_ERROR",
      );
    }

    if (response.status === 401 || response.status === 403) {
      try {
        await response.body?.cancel();
      } catch {
        /* ignore */
      }
      this.clearSession();
      throw new ReauthenticationRequired(`HTTP ${response.status}`);
    }

    return response;
  }

  #checkedUrl(path: string): URL {
    let url: URL;
    try {
      url = new URL(path, BUYME_ORIGIN);
    } catch {
      throw new UpstreamError("INVALID_URL");
    }
    if (url.origin !== BUYME_ORIGIN || url.username || url.password) {
      throw new UpstreamError("UNSUPPORTED_ORIGIN");
    }
    return url;
  }
}
