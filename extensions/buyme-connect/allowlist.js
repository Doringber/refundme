/** Hosts allowed to receive a BuyMe session. Other sites get a no-op script. */
export function isZikuyAppHost(hostname) {
  if (hostname === "justrefundme.netlify.app") return true;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function isBuyMeHost(hostname) {
  return hostname === "buyme.co.il" || hostname === "www.buyme.co.il";
}
