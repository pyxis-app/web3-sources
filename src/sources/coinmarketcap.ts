import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://pro-api.coinmarketcap.com/v2";
const SOURCE = "coinmarketcap";
const QUOTE_TTL = 60 * 1000; // 60s
const TIMEOUT = 4000;

export interface CmcQuote {
  symbol: string;
  name: string;
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  cmcRank: number | null;
}

interface RawQuoteEntry {
  symbol?: string;
  name?: string;
  cmc_rank?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number | null;
  quote?: {
    USD?: {
      price?: number;
      market_cap?: number;
      volume_24h?: number;
      percent_change_24h?: number;
      percent_change_7d?: number;
      percent_change_30d?: number;
    };
  };
}

interface RawResponse {
  data?: Record<string, RawQuoteEntry[] | RawQuoteEntry>;
  status?: { error_code?: number; error_message?: string };
}

function isConfigured(): boolean {
  return Boolean(process.env.CMC_API_KEY);
}

export async function getCmcQuote(
  symbol: string,
): Promise<WithFreshness<CmcQuote | null> | null> {
  if (!isConfigured()) return null;
  const upper = symbol.toUpperCase();
  const res = await fetchJson<RawResponse>(
    `${BASE}/cryptocurrency/quotes/latest?symbol=${upper}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "quote", upper]),
      ttlMs: QUOTE_TTL,
      timeoutMs: TIMEOUT,
      headers: {
        "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY ?? "",
      },
    },
  );
  if (!res) return null;
  const entry = res.data.data?.[upper];
  const raw = Array.isArray(entry) ? entry[0] : entry;
  if (!raw || !raw.symbol) return { data: null, meta: res.meta };
  const usd = raw.quote?.USD ?? {};
  return {
    data: {
      symbol: raw.symbol,
      name: raw.name ?? raw.symbol,
      priceUsd: usd.price ?? null,
      marketCapUsd: usd.market_cap ?? null,
      volume24hUsd: usd.volume_24h ?? null,
      change24h: usd.percent_change_24h ?? null,
      change7d: usd.percent_change_7d ?? null,
      change30d: usd.percent_change_30d ?? null,
      circulatingSupply: raw.circulating_supply ?? null,
      totalSupply: raw.total_supply ?? null,
      maxSupply: raw.max_supply ?? null,
      cmcRank: raw.cmc_rank ?? null,
    },
    meta: res.meta,
  };
}
