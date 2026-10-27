import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORIGIN_MAX_AGE_MS,
  ORIGIN_STORAGE_KEY,
  compareByNearest,
  geolocationErrorMessage,
  readStoredOrigin,
  rowMatchesFilter,
  writeStoredOrigin,
} from "./client-location";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("remembered search origin", () => {
  it("round-trips a GPS fix for the session and expires it", () => {
    const storage = memoryStorage();
    const origin = { lat: 32.0853, lng: 34.7818, source: "device" as const, label: null };
    writeStoredOrigin(storage, origin, 1_000);
    assert.deepEqual(readStoredOrigin(storage, 1_000 + 60_000), origin);
    assert.equal(readStoredOrigin(storage, 1_000 + ORIGIN_MAX_AGE_MS + 1), null);
    assert.equal(storage.data.has(ORIGIN_STORAGE_KEY), false);
  });

  it("ignores tampered or broken values and clears on demand", () => {
    const storage = memoryStorage();
    storage.setItem(ORIGIN_STORAGE_KEY, "{not json");
    assert.equal(readStoredOrigin(storage), null);
    storage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify({ lat: 999, lng: 1, source: "device", at: Date.now() }));
    assert.equal(readStoredOrigin(storage), null);
    writeStoredOrigin(storage, { lat: 32, lng: 34.8, source: "place", label: "גבעתיים" });
    assert.equal(readStoredOrigin(storage)?.label, "גבעתיים");
    writeStoredOrigin(storage, null);
    assert.equal(readStoredOrigin(storage), null);
    assert.equal(readStoredOrigin(null), null);
  });
});

describe("stores page helpers", () => {
  it("explains each geolocation failure in Hebrew", () => {
    assert.match(geolocationErrorMessage(1), /חסום/);
    assert.match(geolocationErrorMessage(3), /זמן/);
    assert.match(geolocationErrorMessage(2), /לא הצלחנו/);
    assert.match(geolocationErrorMessage("unsupported"), /להקליד עיר/);
    assert.match(geolocationErrorMessage("insecure"), /https/);
  });

  it("filters places by name or address, ignoring hyphens and quotes", () => {
    const row = { name: "סינמה סיטי גלילות", detail: "רמת השרון · תל-אביב" };
    assert.equal(rowMatchesFilter(row, "גלילות"), true);
    assert.equal(rowMatchesFilter(row, "תל אביב"), true);
    assert.equal(rowMatchesFilter(row, "סינמה רמת"), true);
    assert.equal(rowMatchesFilter(row, "חיפה"), false);
    assert.equal(rowMatchesFilter(row, "  "), true);
  });

  it("puts cards with a near place first and keeps the rest in order", () => {
    const cards = [
      { nearestKm: null, index: 0 },
      { nearestKm: 7.2, index: 1 },
      { nearestKm: 0.3, index: 2 },
      { nearestKm: null, index: 3 },
    ];
    assert.deepEqual(
      [...cards].sort(compareByNearest).map((card) => card.index),
      [2, 1, 0, 3],
    );
  });
});
