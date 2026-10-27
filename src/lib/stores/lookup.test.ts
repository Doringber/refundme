import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { haversineKm } from "./nearby";
import {
  brandMatchesPlace,
  catalogForVoucher,
  matchCatalogPlaces,
  overpassPlacesOrFailure,
  overpassRegex,
  parseOverpassElements,
  slimCatalog,
} from "./lookup";
import {
  catalogAreaQuery,
  exactMerchantQuery,
  merchantAliases,
  merchantOverpassQuery,
  parseNearbyPayload,
  scopedMerchantQuery,
} from "./search";

describe("BuyMe store lookup", () => {
  it("maps multi-brand cards to the public catalog and leaves a single shop alone", () => {
    const foody = catalogForVoucher({
      merchantName: "BUYME FOODY - מתנות קולינריות שוות",
      usageTerms: "מימוש דרך BuyMe",
      extractionRaw: { supplierName: "BUYME FOODY" },
    });
    assert.equal(foody?.id, "17573460");
    const all = catalogForVoucher({
      merchantName: "BUYME ALL",
      extractionRaw: null,
    });
    assert.equal(all?.id, "13438757");
    assert.equal(
      catalogForVoucher({ merchantName: "FOX", extractionRaw: null }),
      null,
    );
  });

  it("reads brand titles from a BuyMe options payload", () => {
    const summary = slimCatalog("17573460", {
      supplier: { id: 17573460, name: "BUYME FOODY -מתנות קולינריות שוות" },
      brands: [{ title: "קפה גרג" }, { title: "  " }, { title: "קפה גרג" }, { title: "מקס ברנר" }],
    });
    assert.deepEqual(summary?.titles, ["קפה גרג", "מקס ברנר"]);
    assert.equal(slimCatalog("17573460", { supplier: { id: 1 }, brands: [] }), null);
  });

  it("matches a nearby OSM place to a catalog brand and sorts by distance", () => {
    const places = parseOverpassElements({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 32.09,
          lon: 34.78,
          tags: {
            name: "Cafe Greg",
            "name:he": "קפה גרג דיזנגוף",
            "addr:street": "דיזנגוף",
            "addr:housenumber": "50",
            "addr:city": "תל אביב",
          },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 32.2, lon: 34.85 },
          tags: { name: "Max Brenner" },
        },
        {
          type: "node",
          id: 3,
          lat: 32.08,
          lon: 34.77,
          tags: { name: "Unrelated kiosk" },
        },
      ],
    });
    assert.equal(places.length, 3);
    assert.equal(places[0]?.address, "דיזנגוף 50, תל אביב");
    const origin = { lat: 32.075, lng: 34.775 };
    const located = places.map((place) => ({
      ...place,
      distanceKm: haversineKm(origin.lat, origin.lng, place.lat, place.lng),
    }));
    const matches = matchCatalogPlaces(["קפה גרג", "Max Brenner", "MAC"], located);
    assert.deepEqual(
      matches.map((place) => place.brand),
      ["קפה גרג", "Max Brenner"],
    );
    assert.ok(matches[0]!.distanceKm < matches[1]!.distanceKm);
    assert.equal(brandMatchesPlace("Greg", ["MamaGreg"]), false);
    assert.equal(brandMatchesPlace("FOOD TERMINAL", ["4 Food"]), false);
    assert.equal(brandMatchesPlace("סניפים נבחרים ברשת קפה קפה", ["קפה שרגא"]), false);
    assert.equal(brandMatchesPlace("סניפים נבחרים ברשת קפה קפה", ["קפה קפה דיזנגוף"]), true);
    assert.equal(brandMatchesPlace("ZO TLV", ["BY14 TLV Hotel"]), false);
    assert.equal(brandMatchesPlace("רשת לנדוור", ["לנדוור"]), true);
    assert.equal(brandMatchesPlace("מסעדות בנדיקט", ["בנדיקט"]), true);
    assert.equal(brandMatchesPlace("FOX", ["FOX"]), true);
  });

  it("escapes a merchant name before it is placed in an Overpass regex", () => {
    assert.equal(overpassRegex('A."B"'), "A\\.\\\"B\\\"");
  });

  it("treats an Overpass runtime remark as a failure and an empty list as none", () => {
    assert.equal(
      overpassPlacesOrFailure({ remark: "runtime error: Query timed out", elements: [] }),
      null,
    );
    assert.deepEqual(overpassPlacesOrFailure({ elements: [] }), []);
  });
});

describe("nearby query shape", () => {
  it("searches FOX by the exact Hebrew and English names", () => {
    const query = exactMerchantQuery(32.08, 34.77, "FOX");
    assert.match(query, /\[timeout:6\]/);
    assert.match(query, /\["name"="FOX"\]/);
    assert.match(query, /\["name:he"="פוקס"\]/);
    assert.deepEqual(merchantAliases("FOX"), ["FOX", "פוקס", "Fox"]);
    assert.doesNotMatch(query, /nwr\["name"~/);
  });

  it("keeps a fuzzy chain search on shops so it does not scan the whole map", () => {
    const query = scopedMerchantQuery(32.0804, 34.7741, "שופרסל");
    assert.match(query, /\[timeout:8\]/);
    assert.match(query, /nwr\["shop"\]\["name"~/);
    assert.match(query, /שופרסל/);
    assert.doesNotMatch(query, /Shufersal/);
    assert.doesNotMatch(query, /nwr\["name"~/);
    assert.doesNotMatch(query, /around:8000/);
  });

  it("uses one shop-scoped query for a Hebrew chain and an exact query for FOX", () => {
    assert.equal(
      merchantOverpassQuery(32.08, 34.77, "שופרסל"),
      scopedMerchantQuery(32.08, 34.77, "שופרסל"),
    );
    assert.equal(
      merchantOverpassQuery(32.08, 34.77, "FOX"),
      exactMerchantQuery(32.08, 34.77, "FOX"),
    );
  });

  it("limits the catalog area query so a function can answer before Netlify drops it", () => {
    const query = catalogAreaQuery(32.08, 34.77);
    assert.match(query, /\[timeout:8\]/);
    assert.match(query, /\["shop"\]/);
    assert.match(query, /around:3500/);
  });

  it("turns an HTML inactivity page into an empty places status instead of throwing", () => {
    const payload = parseNearbyPayload({
      contentType: "text/html",
      body: "<HTML><TITLE>Inactivity Timeout</TITLE></HTML>",
    });
    assert.equal(payload.status, "places_unavailable");
    assert.deepEqual(payload.places, []);
  });
});
