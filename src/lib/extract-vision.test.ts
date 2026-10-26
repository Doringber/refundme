import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldRunVisionExtraction } from "./extract-vision";

describe("shouldRunVisionExtraction", () => {
  it("requires a signed-in user when Supabase is configured", () => {
    assert.equal(
      shouldRunVisionExtraction({
        visionConfigured: true,
        supabaseConfigured: true,
        authenticated: false,
      }),
      false,
    );
    assert.equal(
      shouldRunVisionExtraction({
        visionConfigured: true,
        supabaseConfigured: true,
        authenticated: true,
      }),
      true,
    );
  });

  it("allows local demo vision only when a key is configured", () => {
    assert.equal(
      shouldRunVisionExtraction({
        visionConfigured: true,
        supabaseConfigured: false,
        authenticated: false,
      }),
      true,
    );
    assert.equal(
      shouldRunVisionExtraction({
        visionConfigured: false,
        supabaseConfigured: false,
        authenticated: false,
      }),
      false,
    );
  });
});