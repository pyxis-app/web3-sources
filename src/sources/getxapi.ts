import { fetchJson } from "../http.js";
import { cacheKey } from "../cache.js";
import type { WithFreshness } from "../freshness.js";

const BASE = "https://api.getxapi.com";
const SOURCE = "getxapi";
const TWEET_TTL = 15 * 60 * 1000; // 15 min — social moves fast
const USER_TTL = 60 * 60 * 1000; // 1h
const TIMEOUT = 5000;

function keyOk(): boolean {
  return Boolean(process.env.GETXAPI_API_KEY);
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.GETXAPI_API_KEY ?? ""}` };
}

export interface CallBudget {
  remaining: number;
}

export function newBudget(): CallBudget {
  const max = parseInt(process.env.GETXAPI_MAX_CALLS ?? "5", 10);
  return { remaining: Math.max(0, Number.isFinite(max) ? max : 5) };
}

export interface TwitterUser {
  username: string;
  name: string;
  followers: number;
  following: number;
  verified: boolean;
  description: string;
  createdAt: string | null;
  postCount: number;
}

export interface Tweet {
  id: string;
  text: string;
  author: string;
  authorFollowers: number;
  likes: number;
  retweets: number;
  replies: number;
  createdAt: string;
}

export interface SentimentBreakdown {
  total: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
}

const POSITIVE_WORDS = new Set([
  "bullish", "moon", "gem", "ath", "alpha", "ape", "lfg", "gm",
  "based", "wagmi", "diamond", "hodl", "buy", "long", "up", "pump",
  "breakout", "rally", "explode", "rocket", "100x", "10x", "winning",
  "legit", "solid", "underrated", "undervalued", "early", "accumulate",
]);

const NEGATIVE_WORDS = new Set([
  "rug", "scam", "dump", "ponzi", "dead", "exit", "sus", "honeypot",
  "bear", "rekt", "sell", "short", "down", "crash", "vapor", "shitcoin",
  "ngmi", "fud", "trash", "garbage", "overvalued", "bubble", "bagholders",
  "exitliq", "wash", "manipulated", "centralized", "censored",
]);

const POS_EMOJI = ["🚀", "📈", "💎", "🌙", "🔥", "💪", "🟢", "🐂"];
const NEG_EMOJI = ["📉", "💀", "🚨", "⚠️", "🔴", "🐻", "🤡"];

function scoreSentiment(tweets: Tweet[]): SentimentBreakdown {
  if (tweets.length === 0) {
    return { total: 0, positivePct: 0, negativePct: 0, neutralPct: 0 };
  }
  let pos = 0;
  let neg = 0;
  let neu = 0;
  for (const t of tweets) {
    const text = t.text.toLowerCase();
    const words = text.split(/[\s.,!?;:"'(){}[\]<>/]+/);
    let p = 0;
    let n = 0;
    for (const w of words) {
      if (POSITIVE_WORDS.has(w)) p++;
      if (NEGATIVE_WORDS.has(w)) n++;
    }
    for (const e of POS_EMOJI) if (text.includes(e)) p++;
    for (const e of NEG_EMOJI) if (text.includes(e)) n++;
    if (p > n) pos++;
    else if (n > p) neg++;
    else neu++;
  }
  const total = tweets.length;
  return {
    total,
    positivePct: Math.round((pos / total) * 100),
    negativePct: Math.round((neg / total) * 100),
    neutralPct: Math.round((neu / total) * 100),
  };
}

interface RawUserResp {
  status?: string;
  data?: {
    userName?: string;
    name?: string;
    followers?: number;
    following?: number;
    isVerified?: boolean;
    description?: string;
    createdAt?: string;
    statusesCount?: number;
  };
}

interface RawTweet {
  id?: string;
  text?: string;
  author?: { userName?: string; followers?: number };
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  createdAt?: string;
}

interface RawTweetsResp {
  status?: string;
  tweets?: RawTweet[];
  data?: RawTweet[];
}

function normalizeTweet(t: RawTweet): Tweet {
  return {
    id: t.id ?? "",
    text: t.text ?? "",
    author: t.author?.userName ?? "",
    authorFollowers: t.author?.followers ?? 0,
    likes: t.likeCount ?? 0,
    retweets: t.retweetCount ?? 0,
    replies: t.replyCount ?? 0,
    createdAt: t.createdAt ?? "",
  };
}

export async function getUserInfo(
  username: string,
  budget: CallBudget,
): Promise<WithFreshness<TwitterUser | null> | null> {
  if (!keyOk() || budget.remaining <= 0) return null;
  budget.remaining--;
  const res = await fetchJson<RawUserResp>(
    `${BASE}/twitter/user/info?userName=${encodeURIComponent(username)}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "user", username.toLowerCase()]),
      ttlMs: USER_TTL,
      timeoutMs: TIMEOUT,
      headers: authHeader(),
    },
  );
  if (!res) return null;
  const d = res.data.data;
  if (!d?.userName) return { data: null, meta: res.meta };
  return {
    data: {
      username: d.userName,
      name: d.name ?? d.userName,
      followers: d.followers ?? 0,
      following: d.following ?? 0,
      verified: Boolean(d.isVerified),
      description: d.description ?? "",
      createdAt: d.createdAt ?? null,
      postCount: d.statusesCount ?? 0,
    },
    meta: res.meta,
  };
}

export async function getUserRecentTweets(
  username: string,
  budget: CallBudget,
  limit = 20,
): Promise<WithFreshness<Tweet[]> | null> {
  if (!keyOk() || budget.remaining <= 0) return null;
  budget.remaining--;
  const res = await fetchJson<RawTweetsResp>(
    `${BASE}/twitter/user/tweets?userName=${encodeURIComponent(username)}`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "userTweets", username.toLowerCase(), limit]),
      ttlMs: TWEET_TTL,
      timeoutMs: TIMEOUT,
      headers: authHeader(),
    },
  );
  if (!res) return null;
  const raw = res.data.tweets ?? res.data.data ?? [];
  const tweets = raw.slice(0, limit).map(normalizeTweet);
  return { data: tweets, meta: res.meta };
}

export interface MentionSearch {
  tweets: Tweet[];
  sentiment: SentimentBreakdown;
  topByEngagement: Tweet[];
  uniqueAuthors: number;
}

export async function searchMentions(
  query: string,
  budget: CallBudget,
): Promise<WithFreshness<MentionSearch> | null> {
  if (!keyOk() || budget.remaining <= 0) return null;
  budget.remaining--;
  const q = `${query} -is:retweet lang:en`;
  const res = await fetchJson<RawTweetsResp>(
    `${BASE}/twitter/tweet/advanced_search?q=${encodeURIComponent(q)}&product=Latest`,
    {
      source: SOURCE,
      cacheKey: cacheKey([SOURCE, "search", query.toLowerCase()]),
      ttlMs: TWEET_TTL,
      timeoutMs: TIMEOUT,
      headers: authHeader(),
    },
  );
  if (!res) return null;
  const raw = res.data.tweets ?? res.data.data ?? [];
  const tweets = raw.map(normalizeTweet);
  const sentiment = scoreSentiment(tweets);
  const topByEngagement = [...tweets]
    .sort((a, b) => b.likes + b.retweets - (a.likes + a.retweets))
    .slice(0, 5);
  const uniqueAuthors = new Set(tweets.map((t) => t.author)).size;
  return {
    data: { tweets, sentiment, topByEngagement, uniqueAuthors },
    meta: res.meta,
  };
}
