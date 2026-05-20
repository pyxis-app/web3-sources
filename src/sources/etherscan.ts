import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.etherscan.io/v2/api";
const SOURCE = "etherscan";
const CONTRACT_TTL = 30 * 24 * 60 * 60 * 1000; // 30d — verified code immutable
const SUPPLY_TTL = 60 * 60 * 1000; // 1h
const TIMEOUT = 4000;

export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  bsc: 56,
};

function chainIdFor(chain: string): number | null {
  return CHAIN_IDS[chain.toLowerCase()] ?? null;
}

function keyOk(): boolean {
  return Boolean(process.env.ETHERSCAN_API_KEY);
}

export interface ContractMeta {
  chain: string;
  address: string;
  verified: boolean;
  name: string | null;
  compilerVersion: string | null;
  hasProxy: boolean;
  hasOwner: boolean;
}

export interface ContractCreation {
  chain: string;
  address: string;
  creator: string;
  creationTxHash: string;
}

export interface TokenSupply {
  chain: string;
  address: string;
  totalSupplyRaw: string;
}

interface RawSourceCodeResponse {
  status?: string;
  result?: Array<{
    SourceCode?: string;
    ABI?: string;
    ContractName?: string;
    CompilerVersion?: string;
    Proxy?: string;
    Implementation?: string;
  }>;
}

interface RawCreationResponse {
  status?: string;
  result?: Array<{
    contractAddress?: string;
    contractCreator?: string;
    txHash?: string;
  }>;
}

interface RawSupplyResponse {
  status?: string;
  result?: string;
}

export async function getContractMeta(
  chain: string,
  address: string,
): Promise<WithFreshness<ContractMeta | null> | null> {
  if (!keyOk()) return null;
  const id = chainIdFor(chain);
  if (!id) return null;
  const url =
    `${BASE}?chainid=${id}&module=contract&action=getsourcecode` +
    `&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`;
  const res = await fetchJson<RawSourceCodeResponse>(url, {
    source: SOURCE,
    cacheKey: cacheKey([SOURCE, "src", id, address.toLowerCase()]),
    ttlMs: CONTRACT_TTL,
    timeoutMs: TIMEOUT,
  });
  if (!res) return null;
  const item = res.data.result?.[0];
  if (!item) return { data: null, meta: res.meta };

  const verified = Boolean(item.SourceCode && item.SourceCode.length > 0);
  const src = (item.SourceCode ?? "").toLowerCase();
  return {
    data: {
      chain,
      address,
      verified,
      name: item.ContractName || null,
      compilerVersion: item.CompilerVersion || null,
      hasProxy: item.Proxy === "1" || Boolean(item.Implementation),
      hasOwner: verified && /\bowner\b|\bonlyowner\b/.test(src),
    },
    meta: res.meta,
  };
}

export async function getContractCreation(
  chain: string,
  address: string,
): Promise<WithFreshness<ContractCreation | null> | null> {
  if (!keyOk()) return null;
  const id = chainIdFor(chain);
  if (!id) return null;
  const url =
    `${BASE}?chainid=${id}&module=contract&action=getcontractcreation` +
    `&contractaddresses=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`;
  const res = await fetchJson<RawCreationResponse>(url, {
    source: SOURCE,
    cacheKey: cacheKey([SOURCE, "creation", id, address.toLowerCase()]),
    ttlMs: CONTRACT_TTL,
    timeoutMs: TIMEOUT,
  });
  if (!res) return null;
  const item = res.data.result?.[0];
  if (!item?.contractAddress) return { data: null, meta: res.meta };
  return {
    data: {
      chain,
      address: item.contractAddress,
      creator: item.contractCreator ?? "",
      creationTxHash: item.txHash ?? "",
    },
    meta: res.meta,
  };
}

export async function getTokenSupply(
  chain: string,
  address: string,
): Promise<WithFreshness<TokenSupply | null> | null> {
  if (!keyOk()) return null;
  const id = chainIdFor(chain);
  if (!id) return null;
  const url =
    `${BASE}?chainid=${id}&module=stats&action=tokensupply` +
    `&contractaddress=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`;
  const res = await fetchJson<RawSupplyResponse>(url, {
    source: SOURCE,
    cacheKey: cacheKey([SOURCE, "supply", id, address.toLowerCase()]),
    ttlMs: SUPPLY_TTL,
    timeoutMs: TIMEOUT,
  });
  if (!res) return null;
  const raw = res.data.result;
  if (!raw || typeof raw !== "string") return { data: null, meta: res.meta };
  return {
    data: { chain, address, totalSupplyRaw: raw },
    meta: res.meta,
  };
}
