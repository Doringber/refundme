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
  chainQuery,
  merchantAliases,
  merchantOverpassQuery,
  overpassTimeoutSec,
  parseNearbyPayload,
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
    const query = chainQuery("FOX");
    assert.match(query, /\[timeout:6\]/);
    assert.match(query, /\["name"="FOX"\]/);
    assert.match(query, /\["name:he"="פוקס"\]/);
    assert.deepEqual(merchantAliases("FOX"), ["FOX", "פוקס", "Fox"]);
    assert.doesNotMatch(query, /nwr\["name"~/);
  });

  it("finds a sparse chain by exact name, brand or operator anywhere in Israel", () => {
    const query = chainQuery("סינמה סיטי");
    for (const key of ["name", "name:en", "brand", "operator", "operator:en"]) {
      assert.ok(query.includes(`nwr["${key}"="סינמה סיטי"]`), key);
      assert.ok(query.includes(`nwr["${key}"="Cinema City"]`), key);
    }
    assert.doesNotMatch(query, /around:/);
    assert.doesNotMatch(query, /~/);
    assert.match(query, /\(29\.45,34\.2,33\.35,35\.9\)/);
  });

  it("keeps a fuzzy chain search on shops so it does not scan the whole map", () => {
    const query = merchantOverpassQuery(32.0804, 34.7741, "שופרסל");
    assert.match(query, /\[timeout:8\]/);
    assert.match(query, /nwr\["shop"\]\["name"~/);
    assert.match(query, /שופרסל/);
    assert.doesNotMatch(query, /Shufersal/);
    assert.doesNotMatch(query, /nwr\["name"~/);
    assert.doesNotMatch(query, /around:8000/);
  });

  it("keeps whole escape sequences in a long scoped merchant pattern", () => {
    const name = `${"א".repeat(39)}"tail`;
    const query = merchantOverpassQuery(32.08, 34.77, name);
    assert.ok(query.includes(`"name"~"${overpassRegex(name)}"]`));
    assert.ok(query.includes(`${"א".repeat(39)}\\""]`));
  });

  it("searches a Latin name nearby and through its Hebrew spelling", () => {
    const query = merchantOverpassQuery(32.08, 34.77, "Cinema City");
    assert.ok(query.includes('nwr["shop"]["name"~"סינמה סיטי"](around:6000,32.08,34.77);'));
    assert.ok(query.includes('nwr["amenity"]["name"~"Cinema City",i](around:6000,32.08,34.77);'));
    assert.doesNotMatch(query, /="Cinema City"/);
    const fox = merchantOverpassQuery(32.08, 34.77, "FOX");
    assert.match(fox, /\["name"~"פוקס"\]/);
    assert.match(fox, /\["name"~"FOX",i\]/);
  });

  it("adds the country-wide chain to the same request until it is cached", () => {
    const query = merchantOverpassQuery(32.08, 34.77, "סינמה סיטי", { withChain: true });
    assert.ok(query.includes('nwr["operator"="סינמה סיטי"](29.45,34.2,33.35,35.9);'));
    assert.ok(query.includes("(around:6000,32.08,34.77)"));
    assert.equal((query.match(/\[out:json\]/g) ?? []).length, 1);
  });

  it("widens with two lean statements so a 20km search fits the budget", () => {
    const query = merchantOverpassQuery(32.08, 34.77, "Cinema City", { radius: 20_000 });
    const statements = query.match(/nwr\[[^;]*;/g) ?? [];
    assert.equal(statements.length, 2);
    assert.ok(statements.every((part) => part.includes("(around:20000,32.08,34.77)")));
    assert.doesNotMatch(query, /,i\]/);
  });

  it("limits the catalog area query so a function can answer before Netlify drops it", () => {
    const query = catalogAreaQuery(32.08, 34.77);
    assert.match(query, /\[timeout:8\]/);
    assert.match(query, /\["shop"\]/);
    assert.match(query, /around:3500/);
    assert.doesNotMatch(query, /out center 120/);
  });

  it("sets the Overpass server timeout inside the remaining budget", () => {
    assert.equal(overpassTimeoutSec(10_000, 0), 8);
    assert.equal(overpassTimeoutSec(5_000, 0), 4);
    assert.equal(overpassTimeoutSec(500, 0), 1);
  });

  it("turns an HTML inactivity page into an empty places status instead of throwing", () => {
    const payload = parseNearbyPayload({
      contentType: "text/html",
      body: "<HTML><TITLE>Inactivity Timeout</TITLE></HTML>",
    });
    assert.equal(payload.status, "places_unavailable");
    assert.deepEqual(payload.places, []);
  });

  it("keeps a branch list without distances and the searched radius", () => {
    const payload = parseNearbyPayload({
      contentType: "application/json",
      body: {
        label: "סינמה סיטי",
        status: "ok",
        radiusKm: 20,
        places: [{ name: "סינמה סיטי גלילות", address: null, distanceKm: null }, { distanceKm: 1 }],
      },
    });
    assert.equal(payload.radiusKm, 20);
    assert.deepEqual(payload.places, [
      { name: "סינמה סיטי גלילות", address: null, distanceKm: null, brand: null },
    ]);
  });
});

describe("merchant aliases", () => {
  it("joins Hebrew and English spellings of one chain and keeps other chains apart", () => {
    assert.deepEqual(merchantAliases("Cinema City"), ["Cinema City", "סינמה סיטי"]);
    assert.deepEqual(merchantAliases("סינמה סיטי"), ["סינמה סיטי", "Cinema City"]);
    assert.ok(!merchantAliases("סינמה סיטי").includes("Yes Planet"));
    assert.deepEqual(merchantAliases("כרטיס סינמה סיטי"), ["כרטיס סינמה סיטי", "סינמה סיטי", "Cinema City"]);
  });

  it("does not attach an alias group on a partial word", () => {
    assert.deepEqual(merchantAliases("PLACE"), ["PLACE"]);
    assert.deepEqual(merchantAliases("Foxtrot"), ["Foxtrot"]);
  });
});
