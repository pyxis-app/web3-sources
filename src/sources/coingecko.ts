import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.coingecko.com/api/v3";
const SOURCE = "coingecko";
const SEARCH_TTL = 60 * 60 * 1000; // 1h — coin id mapping rarely changes
const SNAPSHOT_TTL = 60 * 1000; // 60s — price/volume changes second-to-second
const TIMEOUT = 4000;

export interface CoinHit {
  id: string;
  symbol: string;
  name: string;
}

export interface CoinSnapshot {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  athUsd: number | null;
  athDate: string | null;
  atlUsd: number | null;
  atlDate: string | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  categories: string[];
}

interface RawSearchResponse {
  coins?: Array<{ id: string; symbol: string; name: string }>;
}

interface RawCoinResponse {
  id: string;
  symbol: string;
  name: string;
  categories?: string[];
  market_data?: {
    current_price?: Record<string, number>;
    market_cap?: Record<string, number>;
    total_volume?: Record<string, number>;
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    price_change_percentage_30d?: number;
    ath?: Record<string, number>;
    ath_date?: Record<string, string>;
    atl?: Record<string, number>;
    atl_date?: Record<string, string>;
    circulating_supply?: number;
    total_supply?: number | null;
    max_supply?: number | null;
  };
}

export async function searchCoin(
  query: string,
): Promise<WithFreshness<CoinHit | null> | null> {
  const res = await fetchJson<RawSearchResponse>(
    `${BASE}/search?query=${encodeURIComponent(query)}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "search", query.toLowerCase()]),
      ttlMs: SEARCH_TTL,
      timeoutMs: TIMEOUT,
    },
  );
  if (!res) return null;
  const first = res.data.coins?.[0] ?? null;
  return { data: first, meta: res.meta };
}

export async function getCoinSnapshot(
  id: string,
): Promise<WithFreshness<CoinSnapshot> | null> {
  const url =
    `${BASE}/coins/${encodeURIComponent(id)}` +
    `?localization=false&tickers=false&community_data=false&developer_data=false`;
  const res = await fetchJson<RawCoinResponse>(url, {
    source: SOURCE,
    cacheKey: cacheKey([SOURCE, "coin", id]),
    ttlMs: SNAPSHOT_TTL,
    timeoutMs: TIMEOUT,
  });
  if (!res) return null;
  const m = res.data.market_data ?? {};
  const snapshot: CoinSnapshot = {
    id: res.data.id,
    symbol: res.data.symbol,
    name: res.data.name,
    priceUsd: m.current_price?.usd ?? null,
    marketCapUsd: m.market_cap?.usd ?? null,
    volume24hUsd: m.total_volume?.usd ?? null,
    change24h: m.price_change_percentage_24h ?? null,
    change7d: m.price_change_percentage_7d ?? null,
    change30d: m.price_change_percentage_30d ?? null,
    athUsd: m.ath?.usd ?? null,
    athDate: m.ath_date?.usd ?? null,
    atlUsd: m.atl?.usd ?? null,
    atlDate: m.atl_date?.usd ?? null,
    circulatingSupply: m.circulating_supply ?? null,
    totalSupply: m.total_supply ?? null,
    maxSupply: m.max_supply ?? null,
    categories: res.data.categories ?? [],
  };
  return { data: snapshot, meta: res.meta };
}

export async function getTrending(): Promise<
  WithFreshness<Array<{ id: string; name: string; symbol: string; rank: number }>> | null
> {
  interface RawTrending {
    coins?: Array<{
      item?: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number;
      };
    }>;
  }
  const res = await fetchJson<RawTrending>(`${BASE}/search/trending`, {
    source: SOURCE,
    cacheKey: cacheKey([SOURCE, "trending"]),
    ttlMs: 5 * 60 * 1000,
    timeoutMs: TIMEOUT,
  });
  if (!res) return null;
  const items = (res.data.coins ?? [])
    .map((c) => c.item)
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((x) => ({
      id: x.id,
      name: x.name,
      symbol: x.symbol,
      rank: x.market_cap_rank,
    }));
  return { data: items, meta: res.meta };
}
