import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.llama.fi";
const YIELDS_BASE = "https://yields.llama.fi";
const STABLES_BASE = "https://stablecoins.llama.fi";
const SOURCE = "defillama";
const TIMEOUT = 4000;

const TVL_TTL = 5 * 60 * 1000; // 5 min
const YIELDS_TTL = 60 * 60 * 1000; // 1h
const STABLES_TTL = 60 * 60 * 1000; // 1h

export interface ProtocolSummary {
  name: string;
  slug: string;
  category: string | null;
  tvlUsd: number;
  change1d: number | null;
  change7d: number | null;
  chains: string[];
}

export interface ChainTvl {
  chain: string;
  tvlUsd: number;
}

export interface YieldPool {
  pool: string;
  project: string;
  symbol: string;
  chain: string;
  apy: number;
  tvlUsd: number;
}

export interface StablecoinAgg {
  totalMcapUsd: number;
  top: Array<{ name: string; symbol: string; circulatingUsd: number }>;
}

export async function getProtocol(
  slug: string,
): Promise<WithFreshness<ProtocolSummary | null> | null> {
  interface RawProtocol {
    name?: string;
    slug?: string;
    category?: string;
    tvl?: number | Array<{ totalLiquidityUSD?: number }>;
    change_1d?: number;
    change_7d?: number;
    chains?: string[];
    currentChainTvls?: Record<string, number>;
  }
  const res = await fetchJson<RawProtocol>(
    `${BASE}/protocol/${encodeURIComponent(slug)}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "protocol", slug]),
      ttlMs: TVL_TTL,
      timeoutMs: TIMEOUT,
    },
  );
  if (!res) return null;
  const d = res.data;
  if (!d.name) return { data: null, meta: res.meta };

  // tvl can be a number (sometimes) or an array of historical entries
  let tvlUsd = 0;
  if (typeof d.tvl === "number") {
    tvlUsd = d.tvl;
  } else if (Array.isArray(d.tvl) && d.tvl.length > 0) {
    const last = d.tvl[d.tvl.length - 1];
    tvlUsd = last?.totalLiquidityUSD ?? 0;
  } else if (d.currentChainTvls) {
    tvlUsd = Object.values(d.currentChainTvls).reduce((a, b) => a + b, 0);
  }

  return {
    data: {
      name: d.name,
      slug: d.slug ?? slug,
      category: d.category ?? null,
      tvlUsd,
      change1d: d.change_1d ?? null,
      change7d: d.change_7d ?? null,
      chains: d.chains ?? [],
    },
    meta: res.meta,
  };
}

export async function getChainTvl(
  chain: string,
): Promise<WithFreshness<ChainTvl | null> | null> {
  interface RawChainItem {
    name: string;
    tvl?: number;
    tokenSymbol?: string;
    chainId?: number;
  }
  const res = await fetchJson<RawChainItem[]>(`${BASE}/v2/chains`, {
    source: SOURCE,
    cacheKey: cacheKey([SOURCE, "chains"]),
    ttlMs: TVL_TTL,
    timeoutMs: TIMEOUT,
  });
  if (!res) return null;
  const needle = chain.toLowerCase();
  const hit = res.data.find((c) => c.name.toLowerCase() === needle);
  if (!hit) return { data: null, meta: res.meta };
  return {
    data: { chain: hit.name, tvlUsd: hit.tvl ?? 0 },
    meta: res.meta,
  };
}

export async function getTopYields(
  opts: { chain?: string; project?: string; minTvlUsd?: number; limit?: number } = {},
): Promise<WithFreshness<YieldPool[]> | null> {
  interface RawPool {
    pool: string;
    project: string;
    symbol: string;
    chain: string;
    apy?: number;
    tvlUsd?: number;
  }
  const res = await fetchJson<{ data?: RawPool[] }>(`${YIELDS_BASE}/pools`, {
    source: SOURCE,
    cacheKey: cacheKey([
      SOURCE,
      "yields",
      opts.chain ?? "all",
      opts.project ?? "all",
      opts.minTvlUsd ?? 0,
      opts.limit ?? 10,
    ]),
    ttlMs: YIELDS_TTL,
    timeoutMs: TIMEOUT,
  });
  if (!res) return null;
  const all = res.data.data ?? [];
  // Lower minTvl when filtering by project (smaller protocols have smaller pools)
  const minTvl = opts.minTvlUsd ?? (opts.project ? 100_000 : 1_000_000);
  // Project name on DefiLlama uses spaces/hyphens — normalize both sides
  const projectNorm = opts.project?.toLowerCase().replace(/[-_]/g, " ").trim();
  const filtered = all
    .filter((p) => (opts.chain ? p.chain.toLowerCase() === opts.chain.toLowerCase() : true))
    .filter((p) => {
      if (!projectNorm) return true;
      const pn = p.project.toLowerCase().replace(/[-_]/g, " ");
      return pn.includes(projectNorm) || projectNorm.includes(pn);
    })
    .filter((p) => (p.tvlUsd ?? 0) >= minTvl)
    .filter((p) => typeof p.apy === "number")
    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
    .slice(0, opts.limit ?? 10)
    .map((p) => ({
      pool: p.pool,
      project: p.project,
      symbol: p.symbol,
      chain: p.chain,
      apy: p.apy as number,
      tvlUsd: p.tvlUsd ?? 0,
    }));
  return { data: filtered, meta: res.meta };
}

export async function getStablecoinOverview(
  limit = 5,
): Promise<WithFreshness<StablecoinAgg> | null> {
  interface RawStable {
    name: string;
    symbol: string;
    circulating?: { peggedUSD?: number };
  }
  const res = await fetchJson<{ peggedAssets?: RawStable[] }>(
    `${STABLES_BASE}/stablecoins?includePrices=false`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "stables", limit]),
      ttlMs: STABLES_TTL,
      timeoutMs: TIMEOUT,
    },
  );
  if (!res) return null;
  const all = res.data.peggedAssets ?? [];
  const items = all
    .map((s) => ({
      name: s.name,
      symbol: s.symbol,
      circulatingUsd: s.circulating?.peggedUSD ?? 0,
    }))
    .sort((a, b) => b.circulatingUsd - a.circulatingUsd);
  const totalMcapUsd = items.reduce((a, b) => a + b.circulatingUsd, 0);
  return {
    data: {
      totalMcapUsd,
      top: items.slice(0, limit),
    },
    meta: res.meta,
  };
}
