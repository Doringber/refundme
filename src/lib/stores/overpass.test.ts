import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { queryOverpass } from "./overpass";

const ELEMENTS = {
  elements: [{ type: "node", id: 1, lat: 32.1, lon: 34.8, tags: { amenity: "cinema", name: "סינמה סיטי" } }],
};

type Plan = { delayMs: number; status?: number; body?: unknown; hang?: boolean };

function fakeFetch(plans: Record<string, Plan>) {
  const calls: string[] = [];
  const fetchImpl = (url: string, init: RequestInit) => {
    calls.push(url);
    const plan = plans[url]!;
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (plan.hang) return;
        resolve(
          new Response(JSON.stringify(plan.body ?? ELEMENTS), {
            status: plan.status ?? 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }, plan.delayMs);
      init.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      });
    });
  };
  return { calls, fetchImpl };
}

const MIRRORS = ["a", "b", "c"];

describe("hedged Overpass query", () => {
  it("moves to the next mirror at once when the first answers 502", async () => {
    const { calls, fetchImpl } = fakeFetch({
      a: { delayMs: 5, status: 502 },
      b: { delayMs: 10 },
      c: { delayMs: 10 },
    });
    const started = Date.now();
    const answer = await queryOverpass("q", {
      deadline: started + 3_000,
      hedgeMs: 2_000,
      mirrors: MIRRORS,
      fetchImpl,
    });
    assert.equal(answer?.places[0]?.name, "סינמה סיטי");
    assert.equal(answer?.complete, true);
    assert.deepEqual(calls, ["a", "b"]);
    assert.ok(Date.now() - started < 500);
  });

  it("treats a 200 with a timeout remark and no elements as a failed mirror", async () => {
    const { calls, fetchImpl } = fakeFetch({
      a: { delayMs: 5, body: { remark: "runtime error: Query timed out", elements: [] } },
      b: { delayMs: 5 },
      c: { delayMs: 5 },
    });
    const answer = await queryOverpass("q", {
      deadline: Date.now() + 3_000,
      hedgeMs: 2_000,
      mirrors: MIRRORS,
      fetchImpl,
    });
    assert.equal(answer?.places.length, 1);
    assert.deepEqual(calls, ["a", "b"]);
  });

  it("marks partial elements with a remark as incomplete", async () => {
    const { fetchImpl } = fakeFetch({
      a: { delayMs: 5, body: { ...ELEMENTS, remark: "runtime error: Query timed out" } },
    });
    const answer = await queryOverpass("q", {
      deadline: Date.now() + 3_000,
      hedgeMs: 2_000,
      mirrors: ["a"],
      fetchImpl,
    });
    assert.equal(answer?.complete, false);
    assert.equal(answer?.places.length, 1);
  });

  it("hedges a hanging mirror and returns the faster answer", async () => {
    const { calls, fetchImpl } = fakeFetch({
      a: { delayMs: 0, hang: true },
      b: { delayMs: 20 },
      c: { delayMs: 20 },
    });
    const started = Date.now();
    const answer = await queryOverpass("q", {
      deadline: started + 3_000,
      hedgeMs: 100,
      mirrors: MIRRORS,
      fetchImpl,
    });
    assert.equal(answer?.places.length, 1);
    assert.deepEqual(calls, ["a", "b"]);
    assert.ok(Date.now() - started < 1_000);
  });

  it("gives up at the deadline instead of waiting for a hanging mirror", async () => {
    const { fetchImpl } = fakeFetch({
      a: { delayMs: 0, hang: true },
      b: { delayMs: 0, hang: true },
      c: { delayMs: 0, hang: true },
    });
    const started = Date.now();
    const answer = await queryOverpass("q", {
      deadline: started + 1_500,
      hedgeMs: 100,
      mirrors: MIRRORS,
      fetchImpl,
    });
    assert.equal(answer, null);
    const took = Date.now() - started;
    assert.ok(took >= 1_400 && took < 2_000, String(took));
  });

  it("returns null quickly when every mirror fails", async () => {
    const { fetchImpl } = fakeFetch({
      a: { delayMs: 5, status: 502 },
      b: { delayMs: 5, status: 429 },
      c: { delayMs: 5, status: 403 },
    });
    const started = Date.now();
    const answer = await queryOverpass("q", {
      deadline: started + 5_000,
      hedgeMs: 2_000,
      mirrors: MIRRORS,
      fetchImpl,
    });
    assert.equal(answer, null);
    assert.ok(Date.now() - started < 500);
  });
});
