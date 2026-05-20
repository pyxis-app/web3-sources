import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.alternative.me";
const SOURCE = "alternativeme";
const FNG_TTL = 12 * 60 * 60 * 1000; // 12h — updates daily
const TIMEOUT = 3000;

export interface FearGreedPoint {
  value: number;
  classification: string;
  timestamp: string;
}

export interface FearGreedSeries {
  current: FearGreedPoint;
  history: FearGreedPoint[];
}

interface RawPoint {
  value?: string;
  value_classification?: string;
  timestamp?: string;
  time_until_update?: string;
}

export async function getFearGreed(
  limit = 14,
): Promise<WithFreshness<FearGreedSeries | null> | null> {
  const res = await fetchJson<{ data?: RawPoint[] }>(
    `${BASE}/fng/?limit=${limit}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "fng", limit]),
      ttlMs: FNG_TTL,
      timeoutMs: TIMEOUT,
    },
  );
  if (!res) return null;
  const points: FearGreedPoint[] = (res.data.data ?? [])
    .map((p) => ({
      value: parseInt(p.value ?? "0", 10),
      classification: p.value_classification ?? "",
      timestamp: p.timestamp ?? "",
    }))
    .filter((p) => Number.isFinite(p.value));
  const current = points[0];
  if (!current) return { data: null, meta: res.meta };
  return {
    data: {
      current,
      history: points,
    },
    meta: res.meta,
  };
}
