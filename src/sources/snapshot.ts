import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const ENDPOINT = "https://hub.snapshot.org/graphql";
const SOURCE = "snapshot";
const PROPOSAL_TTL = 30 * 60 * 1000; // 30 min
const TIMEOUT = 5000;

export interface SnapshotProposal {
  id: string;
  title: string;
  state: string;
  scoresTotal: number;
  scores: number[];
  choices: string[];
  start: number;
  end: number;
  link: string;
}

interface RawResponse {
  data?: {
    proposals?: Array<{
      id?: string;
      title?: string;
      state?: string;
      scores_total?: number;
      scores?: number[];
      choices?: string[];
      start?: number;
      end?: number;
      space?: { id?: string };
    }>;
  };
}

function buildQuery(space: string, state?: "active" | "closed", first = 10): string {
  const where = state
    ? `where: { space: "${space}", state: "${state}" }`
    : `where: { space: "${space}" }`;
  return `{
    proposals(${where}, first: ${first}, orderBy: "created", orderDirection: desc) {
      id
      title
      state
      scores_total
      scores
      choices
      start
      end
      space { id }
    }
  }`;
}

async function fetchProposals(
  space: string,
  state: "active" | "closed" | undefined,
  first: number,
): Promise<WithFreshness<SnapshotProposal[]> | null> {
  const query = buildQuery(space, state, first);
  const res = await fetchJson<RawResponse>(ENDPOINT, {
    source: SOURCE,
    cacheKey: cacheKey([SOURCE, space.toLowerCase(), state ?? "any", first]),
    ttlMs: PROPOSAL_TTL,
    timeoutMs: TIMEOUT,
    init: {
      method: "POST",
      body: JSON.stringify({ query }),
    },
    headers: { "Content-Type": "application/json" },
  });
  if (!res) return null;
  const proposals: SnapshotProposal[] = (res.data.data?.proposals ?? [])
    .filter((p) => p.id && p.title)
    .map((p) => ({
      id: p.id!,
      title: p.title!,
      state: p.state ?? "",
      scoresTotal: p.scores_total ?? 0,
      scores: p.scores ?? [],
      choices: p.choices ?? [],
      start: p.start ?? 0,
      end: p.end ?? 0,
      link: `https://snapshot.org/#/${p.space?.id ?? space}/proposal/${p.id}`,
    }));
  return { data: proposals, meta: res.meta };
}

export async function getActiveProposals(
  space: string,
  first = 5,
): Promise<WithFreshness<SnapshotProposal[]> | null> {
  return fetchProposals(space, "active", first);
}
