import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://www.reddit.com";
const SOURCE = "reddit";
const ABOUT_TTL = 60 * 60 * 1000; // 1h
const POSTS_TTL = 30 * 60 * 1000; // 30 min — new posts move slowly
const TIMEOUT = 4000;

// Reddit blocks default fetch UA — provide a clear identifier per their policy.
const HEADERS = { "User-Agent": "Pyxis/0.1 (research swarm; +https://usepyxis.com)" };

export interface SubredditMeta {
  name: string;
  subscribers: number;
  activeUsers: number | null;
  description: string;
  createdUtc: number | null;
}

export interface RedditPost {
  title: string;
  author: string;
  score: number;
  numComments: number;
  url: string;
  permalink: string;
  selftext: string;
  createdUtc: number;
}

interface RawAboutResp {
  data?: {
    display_name?: string;
    subscribers?: number;
    active_user_count?: number | null;
    public_description?: string;
    created_utc?: number;
  };
}

interface RawListing {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        author?: string;
        score?: number;
        num_comments?: number;
        url?: string;
        permalink?: string;
        selftext?: string;
        created_utc?: number;
      };
    }>;
  };
}

export async function getSubredditMeta(
  subreddit: string,
): Promise<WithFreshness<SubredditMeta | null> | null> {
  const sub = subreddit.replace(/^r\//, "");
  const res = await fetchJson<RawAboutResp>(
    `${BASE}/r/${encodeURIComponent(sub)}/about.json`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "about", sub.toLowerCase()]),
      ttlMs: ABOUT_TTL,
      timeoutMs: TIMEOUT,
      headers: HEADERS,
    },
  );
  if (!res) return null;
  const d = res.data.data;
  if (!d?.display_name) return { data: null, meta: res.meta };
  return {
    data: {
      name: d.display_name,
      subscribers: d.subscribers ?? 0,
      activeUsers: d.active_user_count ?? null,
      description: d.public_description ?? "",
      createdUtc: d.created_utc ?? null,
    },
    meta: res.meta,
  };
}

export async function getSubredditNewPosts(
  subreddit: string,
  limit = 10,
): Promise<WithFreshness<RedditPost[]> | null> {
  const sub = subreddit.replace(/^r\//, "");
  const res = await fetchJson<RawListing>(
    `${BASE}/r/${encodeURIComponent(sub)}/new.json?limit=${limit}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "new", sub.toLowerCase(), limit]),
      ttlMs: POSTS_TTL,
      timeoutMs: TIMEOUT,
      headers: HEADERS,
    },
  );
  if (!res) return null;
  const posts = (res.data.data?.children ?? [])
    .map((c) => c.data)
    .filter((d): d is NonNullable<typeof d> => Boolean(d?.title))
    .map((d) => ({
      title: d.title ?? "",
      author: d.author ?? "",
      score: d.score ?? 0,
      numComments: d.num_comments ?? 0,
      url: d.url ?? "",
      permalink: d.permalink ? `https://reddit.com${d.permalink}` : "",
      selftext: (d.selftext ?? "").slice(0, 280),
      createdUtc: d.created_utc ?? 0,
    }));
  return { data: posts, meta: res.meta };
}

