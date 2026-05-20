export interface FreshnessMeta {
  source: string;
  sampledAt: string;
  endpoint: string;
  cached: boolean;
}

export interface WithFreshness<T> {
  data: T;
  meta: FreshnessMeta;
}

export function wrap<T>(
  data: T,
  source: string,
  endpoint: string,
  cached: boolean,
): WithFreshness<T> {
  return {
    data,
    meta: {
      source,
      sampledAt: new Date().toISOString(),
      endpoint,
      cached,
    },
  };
}

export function collectMeta(
  items: Array<WithFreshness<unknown> | null | undefined>,
): FreshnessMeta[] {
  const out: FreshnessMeta[] = [];
  for (const it of items) if (it) out.push(it.meta);
  return out;
}
