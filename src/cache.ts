/**
 * Pluggable caching for source fetches.
 *
 * By default there is NO cache — every call hits the network. To enable
 * caching (recommended in production to respect API rate limits), implement
 * {@link CacheAdapter} over your store of choice (Redis, an in-memory Map,
 * Postgres, etc.) and register it once at startup via {@link configureCache}.
 *
 * @example
 * ```ts
 * import { configureCache } from "@pyxis/web3-sources";
 *
 * const store = new Map<string, { value: unknown; expires: number }>();
 * configureCache({
 *   get: (key) => {
 *     const hit = store.get(key);
 *     if (!hit || hit.expires < Date.now()) return null;
 *     return hit.value;
 *   },
 *   set: (key, value, ttlMs) => {
 *     store.set(key, { value, expires: Date.now() + ttlMs });
 *   },
 * });
 * ```
 */
export interface CacheAdapter {
  /** Return the cached value for `key`, or `null` if absent/expired. */
  get<T>(key: string): Promise<T | null> | T | null;
  /** Store `value` under `key` for `ttlMs` milliseconds. `source` is the originating API id. */
  set<T>(key: string, value: T, ttlMs: number, source: string): Promise<void> | void;
}

let adapter: CacheAdapter | null = null;

/**
 * Register a cache adapter. Pass `null` to disable caching again.
 * Call once at application startup.
 */
export function configureCache(a: CacheAdapter | null): void {
  adapter = a;
}

/** Internal: read through the configured adapter. No-op (returns null) if none set. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!adapter) return null;
  const hit = await adapter.get<T>(key);
  return hit ?? null;
}

/** Internal: write through the configured adapter. No-op if none set. */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number,
  source: string,
): Promise<void> {
  if (!adapter) return;
  await adapter.set(key, value, ttlMs, source);
}

/** Build a deterministic cache key from parts, joined by `:`. */
export function cacheKey(parts: Array<string | number>): string {
  return parts.map(String).join(":");
}
