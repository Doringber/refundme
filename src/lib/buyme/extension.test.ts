import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { isBuyMeHost, isZikuyAppHost } from "../../../extensions/buyme-connect/allowlist.js";
import { readEmberSessionToken } from "../../../extensions/buyme-connect/read-token.js";
import { packBuyMeExtension } from "./extension-pack";

describe("BuyMe ember session reader", () => {
  it("reads the authenticated token and ignores junk", () => {
    const token = ["aaa", "bbb", "ccc"].join(".");
    const raw = JSON.stringify({ authenticated: { token } });
    assert.equal(readEmberSessionToken(raw), token);
    assert.equal(
      readEmberSessionToken(JSON.stringify({ token: ["x", "y"].join(".") })),
      ["x", "y"].join("."),
    );
    assert.equal(readEmberSessionToken(null), null);
    assert.equal(readEmberSessionToken(""), null);
    assert.equal(readEmberSessionToken("{"), null);
    assert.equal(readEmberSessionToken(JSON.stringify({ authenticated: {} })), null);
    assert.equal(readEmberSessionToken(JSON.stringify({ token: "nodot" })), null);
  });
});

describe("BuyMe extension allowlist", () => {
  it("accepts the app and BuyMe hosts only", () => {
    assert.equal(isZikuyAppHost("justrefundme.netlify.app"), true);
    assert.equal(isZikuyAppHost("localhost"), true);
    assert.equal(isZikuyAppHost("127.0.0.1"), true);
    assert.equal(isZikuyAppHost("deploy-preview-21--justrefundme.netlify.app"), false);
    assert.equal(isZikuyAppHost("evil.netlify.app"), false);
    assert.equal(isBuyMeHost("buyme.co.il"), true);
    assert.equal(isBuyMeHost("www.buyme.co.il"), true);
    assert.equal(isBuyMeHost("justrefundme.netlify.app"), false);
  });
});

describe("BuyMe extension zip", () => {
  it("packs a loadable folder without embedding a session", () => {
    const zip = packBuyMeExtension();
    assert.ok(zip);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zikuy-ext-"));
    const file = path.join(dir, "ext.zip");
    fs.writeFileSync(file, zip);
    execFileSync("python3", ["-m", "zipfile", "-t", file], { stdio: "pipe" });
    execFileSync("python3", ["-m", "zipfile", "-e", file, dir], { stdio: "pipe" });
    const root = path.join(dir, "zikuy-buyme-connect");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")) as {
      manifest_version: number;
      background: { service_worker: string };
    };
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.background.service_worker, "background.js");
    const bundled = fs.readdirSync(root).map((name) => fs.readFileSync(path.join(root, name), "utf8")).join("\n");
    assert.equal(bundled.includes("ember_simple_auth-session"), true);
    assert.equal(bundled.includes("console.log"), false);
    assert.equal(bundled.includes("pendingBuyMeToken"), true);
  });
});
