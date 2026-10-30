import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Trusted Web Activity requirements", () => {
  it("manifest can launch fullscreen from the existing start URL", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    assert.equal(manifest.name, "Refunds Bag");
    assert.equal(manifest.short_name, "Refunds Bag");
    assert.equal(manifest.id, "/dashboard");
    assert.equal(manifest.start_url, "/dashboard");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.background_color, "#f6f1e4");
    assert.equal(manifest.theme_color, "#f6f1e4");
    assert.ok(
      manifest.icons.some(
        (icon: { purpose?: string; sizes?: string }) =>
          icon.purpose === "maskable" && icon.sizes === "512x512",
      ),
    );
    assert.ok(
      manifest.icons.some(
        (icon: { purpose?: string; sizes?: string }) =>
          icon.purpose === "any" && icon.sizes === "192x192",
      ),
    );
  });

  it("assetlinks delegates the site to the Android package", () => {
    const statements = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
    assert.equal(statements.length, 1);
    assert.deepEqual(statements[0].relation, ["delegate_permission/common.handle_all_urls"]);
    assert.equal(statements[0].target.namespace, "android_app");
    assert.equal(statements[0].target.package_name, "app.refundsbag");
    const prints = statements[0].target.sha256_cert_fingerprints as string[];
    assert.equal(prints.length, 1);
    assert.match(prints[0], /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/);
  });
});
