// Core types
export type { WithFreshness, FreshnessMeta } from "./freshness.js";
export { wrap, collectMeta } from "./freshness.js";

// Caching (opt-in)
export type { CacheAdapter } from "./cache.js";
export { configureCache, cacheKey } from "./cache.js";

// Low-level fetch helper (for building your own sources)
export type { FetchOpts } from "./http.js";
export { fetchJson } from "./http.js";

// Source clients — 13 free crypto data APIs
export * from "./sources/alternativeme.js";
export * from "./sources/binance.js";
export * from "./sources/coingecko.js";
export * from "./sources/coinmarketcap.js";
export * from "./sources/defillama.js";
export * from "./sources/dexscreener.js";
export * from "./sources/etherscan.js";
export * from "./sources/geckoterminal.js";
export * from "./sources/getxapi.js";
export * from "./sources/reddit.js";
export * from "./sources/snapshot.js";
export * from "./sources/solscan.js";
export * from "./sources/tavily.js";
