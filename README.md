# @pyxis-labs/web3-sources

Typed TypeScript clients for **13 free crypto data APIs** — markets, DeFi, on-chain, and social — in one zero-dependency package. Every response carries source + freshness metadata, and every call is best-effort (returns `null` instead of throwing).

Extracted from the data layer of [Pyxis](https://usepyxis.com), a Web3 research swarm. The clients are open source (MIT); the agent pipeline that consumes them is not.

```bash
npm install @pyxis-labs/web3-sources
```

> Requires Node 18+ (uses global `fetch` and `AbortSignal.timeout`).

## Quick start

```ts
import { getCoinSnapshot, getProtocol, getFearGreed } from "@pyxis-labs/web3-sources";

const eth = await getCoinSnapshot("ethereum");
console.log(eth?.data.priceUsd, eth?.meta.sampledAt);

const aave = await getProtocol("aave");
console.log(aave?.data.tvlUsd);

const fng = await getFearGreed();
console.log(fng?.data.value, fng?.data.classification);
```

## Freshness metadata

Every successful call returns `WithFreshness<T>` — the payload plus where and when it came from:

```ts
interface WithFreshness<T> {
  data: T;
  meta: {
    source: string;     // "coingecko"
    sampledAt: string;  // ISO timestamp
    endpoint: string;   // exact URL hit
    cached: boolean;    // served from your cache adapter?
  };
}
```

`collectMeta([...])` gathers the `meta` of many results into a `FreshnessMeta[]` — handy for building a "data freshness" footer.

## Caching (opt-in)

By default there is **no cache** — every call hits the network. Register a `CacheAdapter` once at startup to respect API rate limits. The adapter is yours: a `Map`, Redis, Postgres, anything.

```ts
import { configureCache } from "@pyxis-labs/web3-sources";

const store = new Map<string, { value: unknown; expires: number }>();
configureCache({
  get: (key) => {
    const hit = store.get(key);
    if (!hit || hit.expires < Date.now()) return null;
    return hit.value;
  },
  set: (key, value, ttlMs) => {
    store.set(key, { value, expires: Date.now() + ttlMs });
  },
});
```

Each source already picks a sensible TTL (60s for prices, 5 min for TVL, 1h for id lookups, etc.).

## Sources

**Keyless** — work out of the box:

| Source | Functions |
|---|---|
| CoinGecko | `searchCoin`, `getCoinSnapshot`, `getTrending` |
| DefiLlama | `getProtocol`, `getChainTvl`, `getTopYields`, `getStablecoinOverview` |
| DexScreener | `searchPairs` |
| GeckoTerminal | `getTrendingPools` |
| Binance (public) | `getSpotTicker` |
| Alternative.me | `getFearGreed` |
| Reddit (JSON) | `getSubredditMeta`, `getSubredditNewPosts` |
| Snapshot (GraphQL) | `getActiveProposals` |

**Keyed** — set the env var or the source returns `null`:

| Source | Env var | Functions |
|---|---|---|
| CoinMarketCap | `CMC_API_KEY` | `getCmcQuote` |
| Etherscan V2 | `ETHERSCAN_API_KEY` | `getContractMeta`, `getContractCreation`, `getTokenSupply` |
| Solscan | `SOLSCAN_API_KEY` | `getSolTokenMeta`, `getSolTopHolders` |
| GetXAPI (Twitter) | `GETXAPI_API_KEY` | `getUserInfo`, `getUserRecentTweets`, `searchMentions` |
| Tavily (news) | `TAVILY_API_KEY` | `searchTavily` |

GetXAPI is metered per call; cap spend per session with `GETXAPI_MAX_CALLS` (default 5) and the `newBudget()` / `CallBudget` helper.

## Build your own source

The same `fetchJson` helper the built-in clients use is exported:

```ts
import { fetchJson, cacheKey } from "@pyxis-labs/web3-sources";

const res = await fetchJson<{ price: number }>("https://api.example.com/price", {
  source: "example",
  cacheKey: cacheKey(["example", "price", "eth"]),
  ttlMs: 60_000,
});
```

## Terms of use

This package ships only the **client code**. It does not bundle, cache, or redistribute any provider's data. When you use it you call those APIs directly with your own keys, and you are responsible for complying with each provider's terms of service and rate limits.

## License

MIT © 2026 Pyxis Authors. See [LICENSE](./LICENSE).
