import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.dexscreener.com/latest/dex";
const SOURCE = "dexscreener";
const PAIR_TTL = 60 * 1000; // 60s — DEX pair data live
const TIMEOUT = 4000;

export interface PairSummary {
  chain: string;
  dex: string;
  pairAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceChange24h: number | null;
  fdvUsd: number | null;
  pairCreatedAtMs: number | null;
}

interface RawPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: { symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  fdv?: number;
  pairCreatedAt?: number;
}

function normalize(p: RawPair): PairSummary {
  return {
    chain: p.chainId ?? "unknown",
    dex: p.dexId ?? "unknown",
    pairAddress: p.pairAddress ?? "",
    baseSymbol: p.baseToken?.symbol ?? "?",
    quoteSymbol: p.quoteToken?.symbol ?? "?",
    priceUsd: p.priceUsd ? parseFloat(p.priceUsd) : null,
    liquidityUsd: p.liquidity?.usd ?? null,
    volume24hUsd: p.volume?.h24 ?? null,
    priceChange24h: p.priceChange?.h24 ?? null,
    fdvUsd: p.fdv ?? null,
    pairCreatedAtMs: p.pairCreatedAt ?? null,
  };
}

export async function searchPairs(
  query: string,
  limit = 5,
): Promise<WithFreshness<PairSummary[]> | null> {
  const res = await fetchJson<{ pairs?: RawPair[] }>(
    `${BASE}/search?q=${encodeURIComponent(query)}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "search", query.toLowerCase(), limit]),
      ttlMs: PAIR_TTL,
      timeoutMs: TIMEOUT,
    },
  );
  if (!res) return null;
  const pairs = (res.data.pairs ?? [])
    .filter((p): p is RawPair => Boolean(p))
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .slice(0, limit)
    .map(normalize);
  return { data: pairs, meta: res.meta };
}

