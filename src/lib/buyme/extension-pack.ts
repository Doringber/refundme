import fs from "node:fs";
import path from "node:path";
import { zipStore } from "./zip-store";

export const BUYME_EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content-app.js",
  "content-buyme.js",
  "allowlist.js",
  "read-token.js",
  "INSTALL.txt",
] as const;

const ZIP_ROOT = "zikuy-buyme-connect";

export function buyMeExtensionDir(): string | null {
  const candidates = [
    path.join(process.cwd(), "extensions", "buyme-connect"),
    path.join(process.cwd(), "..", "extensions", "buyme-connect"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "manifest.json"))) return dir;
  }
  return null;
}

/** Unpacked-extension zip. Null when the source folder is not on disk. */
export function packBuyMeExtension(): Uint8Array | null {
  const dir = buyMeExtensionDir();
  if (!dir) return null;
  const entries = BUYME_EXTENSION_FILES.map((name) => ({
    name: `${ZIP_ROOT}/${name}`,
    data: new Uint8Array(fs.readFileSync(path.join(dir, name))),
  }));
  return zipStore(entries);
}
