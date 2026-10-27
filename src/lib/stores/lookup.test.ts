import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { haversineKm } from "./nearby";
import {
  brandMatchesPlace,
  catalogForVoucher,
  matchCatalogPlaces,
  merchantQuery,
  overpassRegex,
  parseOverpassElements,
  slimCatalog,
} from "./lookup";

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

  it("clips a long merchant name without cutting an escape sequence", () => {
    const head = "a".repeat(39);
    assert.equal(overpassRegex(`${head}.tail`), `${head}\\.`);
    assert.equal(overpassRegex(`${head}"tail`), `${head}\\"`);
    assert.equal(overpassRegex(`${head}😀tail`), `${head}😀`);
    assert.equal(overpassRegex(`${head}  b`), head);
    for (const special of [".", '"', "\\", "(", "|"]) {
      for (const input of [special.repeat(60), `${head}${special}x`]) {
        const trailing = /\\*$/.exec(overpassRegex(input))?.[0] ?? "";
        assert.equal(trailing.length % 2, 0, input);
      }
    }
  });

  it("matches merchant names only inside nearby shops, amenities and hotels", () => {
    const query = merchantQuery(32.0853, 34.7818, "Aroma");
    const around = "(around:8000,32.0853,34.7818)";
    assert.ok(query.includes(`nwr["shop"]${around};`));
    assert.ok(query.includes(`nwr["amenity"]${around};`));
    assert.ok(query.includes(`nwr["tourism"~"^(hotel|guest_house)$"]${around};`));
    assert.ok(query.includes(")->.c;"));
    for (const key of ["name", "name:he", "name:en", "brand"]) {
      assert.ok(query.includes(`nwr.c["${key}"~"Aroma",i];`), key);
    }
    const regexFilters = query.match(/nwr[^;]*"~"Aroma"/g) ?? [];
    assert.equal(regexFilters.length, 4);
    assert.ok(regexFilters.every((filter) => filter.startsWith("nwr.c[")));
  });
});
