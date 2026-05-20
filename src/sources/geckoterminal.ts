import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.geckoterminal.com/api/v2";
const SOURCE = "geckoterminal";
const POOL_TTL = 5 * 60 * 1000; // 5 min — trending shifts slowly
const TIMEOUT = 4000;

export interface TrendingPool {
  network: string;
  dex: string;
  poolAddress: string;
  name: string;
  priceUsd: number | null;
  volume24hUsd: number | null;
  reserveUsd: number | null;
  priceChange24h: number | null;
}

interface RawPool {
  id?: string;
  type?: string;
  attributes?: {
    name?: string;
    address?: string;
    base_token_price_usd?: string | null;
    volume_usd?: { h24?: string };
    reserve_in_usd?: string;
    price_change_percentage?: { h24?: string };
  };
  relationships?: {
    dex?: { data?: { id?: string } };
    network?: { data?: { id?: string } };
  };
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

export async function getTrendingPools(
  network: string,
  limit = 10,
): Promise<WithFreshness<TrendingPool[]> | null> {
  const res = await fetchJson<{ data?: RawPool[] }>(
    `${BASE}/networks/${encodeURIComponent(network)}/trending_pools`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "trending", network, limit]),
      ttlMs: POOL_TTL,
      timeoutMs: TIMEOUT,
    },
  );
  if (!res) return null;
  const pools = (res.data.data ?? []).slice(0, limit).map((p) => {
    const a = p.attributes ?? {};
    return {
      network: p.relationships?.network?.data?.id ?? network,
      dex: p.relationships?.dex?.data?.id ?? "unknown",
      poolAddress: a.address ?? "",
      name: a.name ?? "",
      priceUsd: num(a.base_token_price_usd ?? null),
      volume24hUsd: num(a.volume_usd?.h24 ?? null),
      reserveUsd: num(a.reserve_in_usd ?? null),
      priceChange24h: num(a.price_change_percentage?.h24 ?? null),
    };
  });
  return { data: pools, meta: res.meta };
}
