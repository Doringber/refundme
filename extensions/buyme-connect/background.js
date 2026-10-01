import { isBuyMeHost, isZikuyAppHost } from "./allowlist.js";

const BUYME_HOME = "https://buyme.co.il/";
const BUYME_PATTERNS = ["https://buyme.co.il/*", "https://www.buyme.co.il/*"];
const APP_PATTERNS = [
  "https://justrefundme.netlify.app/*",
  "http://localhost/*",
  "http://127.0.0.1/*",
];

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function notifyAppTabs() {
  const tabs = await chrome.tabs.query({ url: APP_PATTERNS });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null || !isZikuyAppHost(hostOf(tab.url ?? ""))) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "buyme-token-ready" });
      } catch {
        /* tab has no content script yet */
      }
    }),
  );
}

async function ensureBuyMeTab(interactive) {
  const existing = await chrome.tabs.query({ url: BUYME_PATTERNS });
  const found = existing.find((tab) => tab.id != null);
  if (found?.id != null) {
    await chrome.storage.session.remove("createdBuyMeTabId");
    if (interactive) await chrome.tabs.update(found.id, { active: true });
    try {
      await chrome.tabs.sendMessage(found.id, { type: "buyme-reread" });
    } catch {
      /* page still loading */
    }
    return { tabId: found.id, created: false };
  }
  const created = await chrome.tabs.create({
    url: BUYME_HOME,
    active: Boolean(interactive),
  });
  if (created.id == null) return { tabId: null, created: false };
  await chrome.storage.session.set({ createdBuyMeTabId: created.id });
  return { tabId: created.id, created: true };
}

async function closeCreatedTab() {
  const data = await chrome.storage.session.get("createdBuyMeTabId");
  const tabId = data.createdBuyMeTabId;
  if (typeof tabId !== "number") return;
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    /* already closed */
  }
  await chrome.storage.session.remove("createdBuyMeTabId");
}

async function handle(msg, sender) {
  if (msg?.type === "buyme-token-seen") {
    const fromBuyMe =
      sender.id === chrome.runtime.id && isBuyMeHost(hostOf(sender.tab?.url ?? ""));
    const token = typeof msg.token === "string" ? msg.token.trim() : "";
    if (!fromBuyMe || token.split(".").length < 2) return { ok: false };
    await chrome.storage.session.set({ pendingBuyMeToken: token });
    await notifyAppTabs();
    return { ok: true };
  }
  if (msg?.type === "buyme-ensure-tab") {
    if (!isZikuyAppHost(hostOf(sender.tab?.url ?? ""))) return { ok: false };
    const tab = await ensureBuyMeTab(Boolean(msg.interactive));
    return { ok: tab.tabId != null, ...tab };
  }
  if (msg?.type === "buyme-close-created-tab") {
    await closeCreatedTab();
    return { ok: true };
  }
  if (msg?.type === "buyme-focus-app") {
    if (sender.tab?.id != null) {
      await chrome.tabs.update(sender.tab.id, { active: true });
    }
    return { ok: true };
  }
  return undefined;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const task = handle(msg, sender);
  if (!task) return;
  task.then(sendResponse).catch(() => sendResponse({ ok: false }));
  return true;
});
