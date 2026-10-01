import { readEmberSessionToken } from "./read-token.js";

if (window.top === window) {
  let last = "";

  async function publish() {
    const token = readEmberSessionToken(
      localStorage.getItem("ember_simple_auth-session"),
    );
    if (!token || token === last) return;
    last = token;
    try {
      await chrome.runtime.sendMessage({ type: "buyme-token-seen", token });
    } catch {
      /* worker waking up */
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "buyme-reread") {
      last = "";
      void publish();
    }
  });

  void publish();
  window.setInterval(() => {
    void publish();
  }, 1500);
}
