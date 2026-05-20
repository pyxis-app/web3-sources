import { cacheKey, cacheGet, cacheSet } from "../cache.js";
import { wrap, type WithFreshness } from "../freshness.js";

const ENDPOINT = "https://api.tavily.com/search";
const SOURCE = "tavily";
const TTL = 30 * 60 * 1000; // 30 min — news evolves but stabilises in minutes
const TIMEOUT = 30_000;

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
}

interface RawResponse {
  results?: TavilyResult[];
}

/**
 * Search recent news/web via the Tavily API. Requires `TAVILY_API_KEY` in the
 * environment; returns `null` if unset or on any error. Uses a POST request
 * (unlike the GET-based sources) so it doesn't go through `fetchJson`, but it
 * honours the same pluggable cache.
 */
export async function searchTavily(
  query: string,
  maxResults = 2,
): Promise<WithFreshness<TavilyResult[]> | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;

  const ck = cacheKey([SOURCE, "search", query.toLowerCase(), maxResults]);
  const hit = await cacheGet<TavilyResult[]>(ck);
  if (hit) return wrap(hit, SOURCE, ENDPOINT, true);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as RawResponse;
    const results = json.results ?? [];
    await cacheSet(ck, results, TTL, SOURCE);
    return wrap(results, SOURCE, ENDPOINT, false);
  } catch {
    return null;
  }
}
