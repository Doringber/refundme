import { isZikuyAppHost } from "./allowlist.js";

if (isZikuyAppHost(location.hostname)) {
  let flushLock = null;

  function reply(id, payload) {
    window.postMessage(
      {
        source: "zikuy-extension",
        type: "zikuy-buyme-result",
        id,
        payload,
      },
      location.origin,
    );
  }

  function push(payload) {
    window.postMessage(
      { source: "zikuy-extension", type: "zikuy-buyme-pushed", payload },
      location.origin,
    );
  }

  async function doFlush() {
    const stored = await chrome.storage.session.get("pendingBuyMeToken");
    const token = stored.pendingBuyMeToken;
    if (typeof token !== "string" || token.split(".").length < 2) {
      return { ok: false, error: "login_required", sync: null };
    }
    let response;
    try {
      response = await fetch("/api/buyme/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {
      return { ok: false, error: "sync_failed", sync: null };
    }
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    await chrome.storage.session.remove("pendingBuyMeToken");
    const sync = body && typeof body === "object" ? (body.sync ?? null) : null;
    if (response.ok && sync?.status === "synced") {
      try {
        await chrome.runtime.sendMessage({ type: "buyme-close-created-tab" });
        await chrome.runtime.sendMessage({ type: "buyme-focus-app" });
      } catch {
        /* ignore */
      }
    }
    return {
      ok: response.ok,
      error: typeof body.error === "string" ? body.error : null,
      sync,
    };
  }

  function flush() {
    if (!flushLock) {
      flushLock = doFlush().finally(() => {
        flushLock = null;
      });
    }
    return flushLock;
  }

  function waitForToken(timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (found) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.clearInterval(poll);
        chrome.runtime.onMessage.removeListener(onReady);
        resolve(found);
      };
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      const poll = window.setInterval(() => {
        void chrome.storage.session.get("pendingBuyMeToken").then((data) => {
          if (typeof data.pendingBuyMeToken === "string") finish(true);
        });
      }, 1000);
      function onReady(msg) {
        if (msg?.type === "buyme-token-ready") finish(true);
      }
      chrome.runtime.onMessage.addListener(onReady);
      void chrome.storage.session.get("pendingBuyMeToken").then((data) => {
        if (typeof data.pendingBuyMeToken === "string") finish(true);
      });
    });
  }

  async function capture(interactive) {
    const existing = await chrome.storage.session.get("pendingBuyMeToken");
    if (typeof existing.pendingBuyMeToken === "string") return flush();

    let ensured = { ok: false, created: false };
    try {
      ensured = await chrome.runtime.sendMessage({
        type: "buyme-ensure-tab",
        interactive,
      });
    } catch {
      return { ok: false, error: "buyme_unreachable", sync: null };
    }
    if (!ensured?.ok) return { ok: false, error: "buyme_unreachable", sync: null };

    const found = await waitForToken(interactive ? 5 * 60 * 1000 : 20000);
    if (!found) {
      if (ensured.created && !interactive) {
        try {
          await chrome.runtime.sendMessage({ type: "buyme-close-created-tab" });
        } catch {
          /* ignore */
        }
      }
      return { ok: false, error: "login_required", sync: null };
    }
    return flush();
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "zikuy-page") return;
    if (data.type === "zikuy-buyme-ping") {
      window.postMessage(
        { source: "zikuy-extension", type: "zikuy-buyme-pong" },
        location.origin,
      );
      return;
    }
    if (data.type === "zikuy-buyme-capture") {
      void capture(Boolean(data.interactive)).then((payload) => {
        reply(data.id, payload);
      });
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "buyme-token-ready") return;
    void flush().then(push);
  });

  void chrome.storage.session.get("pendingBuyMeToken").then((data) => {
    if (typeof data.pendingBuyMeToken !== "string") return;
    void flush().then(push);
  });
}
