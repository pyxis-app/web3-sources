import { cacheGet, cacheSet } from "./cache.js";
import { wrap, type WithFreshness } from "./freshness.js";

export interface FetchOpts {
  /** Source id recorded in freshness metadata (e.g. "coingecko"). */
  source: string;
  /** Abort the request after this many ms. Default 4000. */
  timeoutMs?: number;
  /** If set, read/write the configured cache under this key. */
  cacheKey?: string;
  /** Cache TTL in ms. Only used when `cacheKey` is set and a cache adapter is configured. */
  ttlMs?: number;
  /** Extra request headers (merged over `Accept: application/json`). */
  headers?: Record<string, string>;
  /** Passed through to `fetch` (method, body, etc.). */
  init?: RequestInit;
}

/**
 * Fetch JSON with optional caching and freshness metadata.
 *
 * Never throws: on non-2xx, network error, or timeout it returns `null`, so
 * callers can treat every source as best-effort. On success it returns the
 * parsed body wrapped with `{ source, sampledAt, endpoint, cached }` metadata.
 *
 * Requires a global `fetch` and `AbortSignal.timeout` (Node >= 18).
 */
export async function fetchJson<T>(
  url: string,
  opts: FetchOpts,
): Promise<WithFreshness<T> | null> {
  const timeout = opts.timeoutMs ?? 4000;

  if (opts.cacheKey) {
    const hit = await cacheGet<T>(opts.cacheKey);
    if (hit !== null) {
      return wrap(hit, opts.source, url, true);
    }
  }

  try {
    const res = await fetch(url, {
      ...opts.init,
      headers: { Accept: "application/json", ...(opts.headers ?? {}) },
      signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as T;

    if (opts.cacheKey && opts.ttlMs) {
      await cacheSet(opts.cacheKey, data, opts.ttlMs, opts.source);
    }

    return wrap(data, opts.source, url, false);
  } catch {
    return null;
  }
}
