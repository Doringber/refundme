export type BuyMeExtensionSync = {
  status: "synced" | "login_required" | "error";
  upserted: number;
  fetched?: number;
  error?: string;
};

export type BuyMeExtensionCapture = {
  ok: boolean;
  error: string | null;
  sync: BuyMeExtensionSync | null;
};

const PAGE = "zikuy-page";
const EXT = "zikuy-extension";

function sameOriginMessage(event: MessageEvent): { source?: string; type?: string; id?: string; payload?: BuyMeExtensionCapture } | null {
  if (event.origin !== window.location.origin) return null;
  const data = event.data as {
    source?: string;
    type?: string;
    id?: string;
    payload?: BuyMeExtensionCapture;
  } | null;
  if (!data || typeof data !== "object") return null;
  return data;
}

/** True when the BuyMe connect extension content script answered. */
export function detectBuyMeExtension(timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (found: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(found);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    function onMessage(event: MessageEvent) {
      const data = sameOriginMessage(event);
      if (data?.source === EXT && data.type === "zikuy-buyme-pong") finish(true);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: PAGE, type: "zikuy-buyme-ping" }, window.location.origin);
  });
}

/**
 * Ask the extension to read the BuyMe session already in this browser and
 * POST it to our origin. The page never receives the token.
 */
export function captureBuyMeFromExtension(opts: {
  interactive: boolean;
}): Promise<BuyMeExtensionCapture> {
  const timeoutMs = opts.interactive ? 5 * 60 * 1000 + 20000 : 25000;
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    let settled = false;
    const finish = (result: BuyMeExtensionCapture) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(result);
    };
    const timer = window.setTimeout(
      () => finish({ ok: false, error: "timeout", sync: null }),
      timeoutMs,
    );
    function onMessage(event: MessageEvent) {
      const data = sameOriginMessage(event);
      if (data?.source !== EXT || data.type !== "zikuy-buyme-result" || data.id !== id) {
        return;
      }
      finish(
        data.payload ?? { ok: false, error: "sync_failed", sync: null },
      );
    }
    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: PAGE, type: "zikuy-buyme-capture", id, interactive: opts.interactive },
      window.location.origin,
    );
  });
}
