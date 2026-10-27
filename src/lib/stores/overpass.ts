import { overpassPlacesOrFailure, type GeoPlace } from "@/lib/stores/lookup";
import { MIN_ATTEMPT_MS, OVERPASS_MIRRORS } from "@/lib/stores/search";

export type OverpassAnswer = {
  places: GeoPlace[];
  /** False when Overpass added a runtime remark: the list may be cut short. */
  complete: boolean;
};

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type OverpassOptions = {
  deadline: number;
  /** Start the next mirror if the current one has not answered by then. */
  hedgeMs: number;
  mirrors?: readonly string[];
  fetchImpl?: FetchLike;
};

/**
 * First usable answer from the mirrors, or null by `deadline`.
 * A mirror that fails (HTTP error, HTML page, runtime remark with no elements)
 * hands over to the next one at once; a slow one is hedged after `hedgeMs`.
 */
export function queryOverpass(
  query: string,
  { deadline, hedgeMs, mirrors = OVERPASS_MIRRORS, fetchImpl = fetch }: OverpassOptions,
): Promise<OverpassAnswer | null> {
  return new Promise((resolve) => {
    const controllers: AbortController[] = [];
    let nextMirror = 0;
    let pending = 0;
    let done = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (answer: OverpassAnswer | null) => {
      if (done) return;
      done = true;
      clearTimeout(hedgeTimer);
      clearTimeout(deadlineTimer);
      for (const controller of controllers) controller.abort();
      resolve(answer);
    };

    const launch = () => {
      if (done) return;
      clearTimeout(hedgeTimer);
      const left = deadline - Date.now();
      if (nextMirror >= mirrors.length || left < MIN_ATTEMPT_MS) {
        if (pending === 0) finish(null);
        return;
      }
      const url = mirrors[nextMirror++]!;
      const controller = new AbortController();
      controllers.push(controller);
      pending += 1;
      hedgeTimer = setTimeout(launch, hedgeMs);
      fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          // The French mirror answers 403 to agents it does not recognise, including ones with a URL.
          "user-agent": "refundme-stores",
          accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`overpass ${response.status}`);
          const json: unknown = await response.json();
          const places = overpassPlacesOrFailure(json);
          if (!places) throw new Error("overpass remark");
          const remark = (json as { remark?: unknown }).remark;
          finish({ places, complete: typeof remark !== "string" || !remark.trim() });
        })
        .catch(() => {
          pending -= 1;
          launch();
        });
    };

    const deadlineTimer = setTimeout(() => finish(null), Math.max(0, deadline - Date.now()));
    launch();
  });
}
