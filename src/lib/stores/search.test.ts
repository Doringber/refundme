import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isNonBusinessPlace,
  matchCatalogPlaces,
  parseOverpassElements,
  type GeoPlace,
} from "./lookup";
import {
  isChainPlace,
  nextMerchantRadius,
  placeNamesMerchant,
  rankPlaces,
  toStoredPlace,
} from "./search";

const TEL_AVIV = { lat: 32.0853, lng: 34.7818 };

/** Real OSM tags seen for "סינמה סיטי" on the French Overpass mirror. */
const CINEMA_CITY_ELEMENTS = [
  {
    type: "node",
    id: 246270624,
    lat: 32.1446,
    lon: 34.8077,
    tags: {
      amenity: "cinema",
      name: "סינמה סיטי גלילות",
      "name:en": "Cinema City Glilot",
      operator: "סינמה סיטי",
      "operator:en": "Cinema City",
    },
  },
  {
    type: "node",
    id: 1803065111,
    lat: 32.1447,
    lon: 34.8079,
    tags: { name: "סינמה סיטי", highway: "bus_stop", public_transport: "platform" },
  },
  {
    type: "way",
    id: 1,
    center: { lat: 32.1449, lon: 34.8069 },
    tags: { amenity: "parking", name: "חניון סינמה סיטי גלילות" },
  },
  {
    type: "way",
    id: 149074575,
    center: { lat: 31.9837, lon: 34.7708 },
    tags: { amenity: "parking", name: "Cinema City", parking: "surface" },
  },
  {
    type: "node",
    id: 1636279586,
    lat: 31.9839,
    lon: 34.771,
    tags: { amenity: "cinema", name: "סינמה סיטי ראשון לציון", operator: "סינמה סיטי" },
  },
  {
    type: "way",
    id: 2,
    center: { lat: 31.984, lon: 34.7712 },
    tags: { shop: "mall", name: "סינמה סיטי ראשון לציון" },
  },
  {
    type: "node",
    id: 3,
    lat: 32.05,
    lon: 34.76,
    tags: { place: "city", name: "יפו-תל אביב" },
  },
];

describe("non-business map objects", () => {
  it("drops parking, bus stops and place names but keeps shops and bare names", () => {
    assert.equal(isNonBusinessPlace({ amenity: "parking" }), true);
    assert.equal(isNonBusinessPlace({ highway: "bus_stop", bench: "yes" }), true);
    assert.equal(isNonBusinessPlace({ place: "city" }), true);
    assert.equal(isNonBusinessPlace({ amenity: "cinema" }), false);
    assert.equal(isNonBusinessPlace({ shop: "mall", landuse: "retail" }), false);
    assert.equal(isNonBusinessPlace({ name: "Cafe Greg" }), false);
    const names = parseOverpassElements({ elements: CINEMA_CITY_ELEMENTS }).map((p) => p.name);
    assert.deepEqual(names, [
      "סינמה סיטי גלילות",
      "סינמה סיטי ראשון לציון",
      "סינמה סיטי ראשון לציון",
    ]);
  });
});

describe("merchant ranking", () => {
  const places = parseOverpassElements({ elements: CINEMA_CITY_ELEMENTS });

  it("recognises a branch by its operator tag and in any alias", () => {
    const glilot = places[0]!;
    assert.equal(isChainPlace(glilot, "סינמה סיטי"), true);
    assert.equal(isChainPlace(glilot, "Cinema City"), true);
    assert.equal(isChainPlace(glilot, "יס פלאנט"), false);
  });

  it("keeps whole-word name matches only", () => {
    const fox = (name: string): GeoPlace => ({
      name,
      names: [name],
      chainNames: [name],
      address: null,
      lat: 32,
      lng: 34.8,
    });
    assert.equal(placeNamesMerchant(fox("FOX Home"), "FOX"), true);
    assert.equal(placeNamesMerchant(fox("פוקס דיזנגוף"), "FOX"), true);
    assert.equal(placeNamesMerchant(fox("Foxtrot Bar"), "FOX"), false);
    assert.equal(placeNamesMerchant(places[0]!, "Cinema City"), true);
  });

  it("sorts by distance, merges a node and its building, and drops far branches", () => {
    const far = { name: "סינמה סיטי באר שבע", address: null, lat: 31.25, lng: 34.79 };
    const rows = rankPlaces([...places.map(toStoredPlace), far], TEL_AVIV, {
      brand: "סינמה סיטי",
    });
    assert.deepEqual(
      rows.map((row) => row.name),
      ["סינמה סיטי גלילות", "סינמה סיטי ראשון לציון"],
    );
    assert.ok(rows[0]!.distanceKm! > 6 && rows[0]!.distanceKm! < 8);
    assert.ok(rows[0]!.distanceKm! < rows[1]!.distanceKm!);
    assert.equal(rows[0]!.brand, "סינמה סיטי");
  });

  it("lists known branches by name when there is no location", () => {
    const rows = rankPlaces(places.map(toStoredPlace), null);
    assert.ok(rows.every((row) => row.distanceKm == null));
    assert.deepEqual(
      rows.map((row) => row.name),
      ["סינמה סיטי גלילות", "סינמה סיטי ראשון לציון"],
    );
  });
});

describe("merchant search radius", () => {
  it("widens 6 -> 20 -> 40km only while nothing is inside the searched radius", () => {
    assert.equal(nextMerchantRadius({ searched: 6_000, nearestKm: null, leftMs: 5_000 }), 20_000);
    assert.equal(nextMerchantRadius({ searched: 6_000, nearestKm: 7.2, leftMs: 5_000 }), 20_000);
    assert.equal(nextMerchantRadius({ searched: 6_000, nearestKm: 1.9, leftMs: 5_000 }), null);
    assert.equal(nextMerchantRadius({ searched: 20_000, nearestKm: 39.6, leftMs: 4_000 }), 40_000);
    assert.equal(nextMerchantRadius({ searched: 40_000, nearestKm: null, leftMs: 8_000 }), null);
  });

  it("stops widening when the budget cannot fit another query", () => {
    assert.equal(nextMerchantRadius({ searched: 6_000, nearestKm: null, leftMs: 3_000 }), null);
  });
});

describe("catalog matching", () => {
  it("prefers the first catalog title and lists one row per branch", () => {
    const places = parseOverpassElements({
      elements: [
        { type: "node", id: 1, lat: 32.08, lon: 34.78, tags: { amenity: "cafe", name: "קפה גרג" } },
        { type: "way", id: 2, center: { lat: 32.0801, lon: 34.7801 }, tags: { building: "yes", name: "קפה גרג" } },
        { type: "node", id: 3, lat: 32.09, lon: 34.78, tags: { amenity: "cafe", name: "Cafe Greg" } },
      ],
    }).map((place) => ({ ...place, distanceKm: Math.abs(place.lat - 32.0) * 100 }));
    const rows = matchCatalogPlaces(["סניפים נבחרים ברשת קפה גרג", "גרג"], places);
    assert.deepEqual(
      rows.map((row) => [row.name, row.brand]),
      [["קפה גרג", "סניפים נבחרים ברשת קפה גרג"]],
    );
  });
});
