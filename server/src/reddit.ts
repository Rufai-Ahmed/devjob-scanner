import { batchMap, fetchWithTimeout } from './utils';

const PUBLIC_BASE = 'https://www.reddit.com';
const OAUTH_BASE = 'https://oauth.reddit.com';
const UA = 'DevJobScanner/2.0';
const MAX_AGE_MINUTES = 20;

// Reddit blocks unauthenticated JSON from most cloud IPs (403). If
// REDDIT_CLIENT_ID/SECRET are set, use the free OAuth API instead.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  try {
    const res = await fetchWithTimeout('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      console.error(`Reddit token request failed: ${res.status}`);
      return null;
    }
    const json = await res.json() as any;
    cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return cachedToken.token;
  } catch (e) {
    console.error('Reddit token error:', e);
    return null;
  }
}

export interface Post {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  created_utc: number;
  num_comments: number;
  isLead: boolean;
  source: 'reddit' | 'craigslist' | 'hn' | 'bluesky';
  recruit?: boolean;
}

export interface LeadOpts {
  idPrefix: string;
  recruit?: boolean;
}

async function redditGet(path: string): Promise<any[]> {
  try {
    const token = await getOAuthToken();
    const url = (token ? OAUTH_BASE : PUBLIC_BASE) + path;
    const headers: Record<string, string> = { 'User-Agent': UA };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) {
      console.error(`Reddit ${res.status} for ${url}`);
      return [];
    }
    const json = await res.json() as any;
    return json.data?.children?.map((c: any) => c.data) ?? [];
  } catch (e) {
    console.error(`Reddit fetch error for ${path}:`, e);
    return [];
  }
}

function isRecent(p: any): boolean {
  return (Date.now() / 1000 - p.created_utc) / 60 < MAX_AGE_MINUTES;
}

function isFresh(p: any): boolean {
  return isRecent(p) && p.num_comments === 0;
}

function toPost(p: any, id: string, isLead: boolean): Post {
  return { id, title: p.title, subreddit: p.subreddit, permalink: p.permalink, created_utc: p.created_utc, num_comments: p.num_comments, isLead, source: 'reddit' };
}

export async function fetchJobBoards(subreddits: string[]): Promise<Post[]> {
  const results = await batchMap(subreddits, sub => redditGet(`/r/${sub}/new.json?limit=25&raw_json=1`));
  return results.flat().filter(isFresh).map(p => toPost(p, p.id, false));
}

export async function fetchSearchLeads(terms: string[], opts: LeadOpts = { idPrefix: 'search' }): Promise<Post[]> {
  const results = await batchMap(terms, async term => {
    const q = encodeURIComponent(`title:"${term}"`);
    const posts = await redditGet(`/search.json?q=${q}&sort=new&t=hour&limit=25&raw_json=1`);
    return posts
      .filter(p => p.title.toLowerCase().includes(term.toLowerCase()) && isRecent(p))
      .map(p => ({ ...toPost(p, `${opts.idPrefix}_${p.id}`, true), recruit: opts.recruit }));
  });
  return results.flat();
}

export async function fetchDiscovery(subreddits: string[], keywords: string[], opts: LeadOpts = { idPrefix: 'disc' }): Promise<Post[]> {
  if (!keywords.length) return [];
  const lc = keywords.map(k => k.toLowerCase());
  const results = await batchMap(subreddits, sub => redditGet(`/r/${sub}/new.json?limit=25&raw_json=1`));
  return results.flat()
    .filter(p => lc.some(kw => p.title.toLowerCase().includes(kw)) && isRecent(p))
    .map(p => ({ ...toPost(p, `${opts.idPrefix}_${p.id}`, true), recruit: opts.recruit }));
}
