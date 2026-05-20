import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.binance.com/api/v3";
const SOURCE = "binance";
const TICKER_TTL = 60 * 1000; // 60s
const TIMEOUT = 3000;

export interface SpotTicker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volumeBase: number;
  volumeQuoteUsd: number;
}

interface RawTicker {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
  quoteVolume?: string;
}

export async function getSpotTicker(
  symbol: string,
): Promise<WithFreshness<SpotTicker | null> | null> {
  const upper = symbol.toUpperCase();
  const res = await fetchJson<RawTicker>(
    `${BASE}/ticker/24hr?symbol=${upper}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "ticker", upper]),
      ttlMs: TICKER_TTL,
      timeoutMs: TIMEOUT,
    },
  );
  if (!res) return null;
  if (!res.data.symbol) return { data: null, meta: res.meta };
  return {
    data: {
      symbol: res.data.symbol,
      lastPrice: parseFloat(res.data.lastPrice ?? "0"),
      priceChangePercent: parseFloat(res.data.priceChangePercent ?? "0"),
      highPrice: parseFloat(res.data.highPrice ?? "0"),
      lowPrice: parseFloat(res.data.lowPrice ?? "0"),
      volumeBase: parseFloat(res.data.volume ?? "0"),
      volumeQuoteUsd: parseFloat(res.data.quoteVolume ?? "0"),
    },
    meta: res.meta,
  };
}
