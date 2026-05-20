import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://pro-api.solscan.io/v2.0";
const SOURCE = "solscan";
const META_TTL = 60 * 60 * 1000; // 1h
const HOLDERS_TTL = 60 * 60 * 1000; // 1h
const TIMEOUT = 4000;

function keyOk(): boolean {
  return Boolean(process.env.SOLSCAN_API_KEY);
}

export interface SolTokenMeta {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  supply: string | null;
  holderCount: number | null;
  createdSlot: number | null;
}

export interface SolHolder {
  owner: string;
  amount: string;
  rank: number;
  percentage: number | null;
}

interface RawMetaResp {
  success?: boolean;
  data?: {
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    supply?: string;
    holder?: number;
    create_slot?: number;
  };
}

interface RawHoldersResp {
  success?: boolean;
  data?: {
    total?: number;
    items?: Array<{
      address?: string;
      amount?: string;
      rank?: number;
      percentage?: number;
    }>;
  };
}

export async function getSolTokenMeta(
  address: string,
): Promise<WithFreshness<SolTokenMeta | null> | null> {
  if (!keyOk()) return null;
  const res = await fetchJson<RawMetaResp>(
    `${BASE}/token/meta?address=${address}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "meta", address]),
      ttlMs: META_TTL,
      timeoutMs: TIMEOUT,
      headers: { token: process.env.SOLSCAN_API_KEY ?? "" },
    },
  );
  if (!res) return null;
  const d = res.data.data;
  if (!d?.address) return { data: null, meta: res.meta };
  return {
    data: {
      address: d.address,
      name: d.name ?? null,
      symbol: d.symbol ?? null,
      decimals: d.decimals ?? null,
      supply: d.supply ?? null,
      holderCount: d.holder ?? null,
      createdSlot: d.create_slot ?? null,
    },
    meta: res.meta,
  };
}

export async function getSolTopHolders(
  address: string,
  limit = 10,
): Promise<WithFreshness<SolHolder[]> | null> {
  if (!keyOk()) return null;
  const res = await fetchJson<RawHoldersResp>(
    `${BASE}/token/holders?address=${address}&page=1&page_size=${limit}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "holders", address, limit]),
      ttlMs: HOLDERS_TTL,
      timeoutMs: TIMEOUT,
      headers: { token: process.env.SOLSCAN_API_KEY ?? "" },
    },
  );
  if (!res) return null;
  const items = (res.data.data?.items ?? [])
    .filter((h) => h.address)
    .map((h, i) => ({
      owner: h.address ?? "",
      amount: h.amount ?? "0",
      rank: h.rank ?? i + 1,
      percentage: h.percentage ?? null,
    }));
  return { data: items, meta: res.meta };
}
