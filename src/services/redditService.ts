import { RedditPost } from '../types';

const REDDIT_BASE = 'https://www.reddit.com';

interface RedditChild {
  data: {
    id: string;
    title: string;
    selftext: string;
    subreddit: string;
    author: string;
    created_utc: number;
    num_comments: number;
    score: number;
    permalink: string;
    url: string;
  };
}

interface RedditApiResponse {
  data: { children: RedditChild[] };
}

export async function fetchSubredditPosts(subredditName: string): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${subredditName}/new.json?limit=25&raw_json=1`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DevJobScanner/1.0 (personal app)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as RedditApiResponse;
    return json.data.children.map(c => ({
      id: c.data.id,
      title: c.data.title,
      selftext: c.data.selftext ?? '',
      subreddit: c.data.subreddit,
      author: c.data.author,
      created_utc: c.data.created_utc,
      num_comments: c.data.num_comments,
      score: c.data.score,
      permalink: c.data.permalink,
      url: `${REDDIT_BASE}${c.data.permalink}`,
    }));
  } catch (err) {
    console.error(`[Reddit] Failed to fetch r/${subredditName}:`, err);
    return [];
  }
}

export async function fetchRedditSearch(terms: string[]): Promise<RedditPost[]> {
  const results = await Promise.allSettled(
    terms.map(async term => {
      const q = encodeURIComponent(term);
      const url = `${REDDIT_BASE}/search.json?q=${q}&sort=new&t=day&limit=25&raw_json=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'DevJobScanner/1.0 (personal app)' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as RedditApiResponse;
      return json.data.children.map(c => ({
        id: `search_${c.data.id}`,
        title: c.data.title,
        selftext: c.data.selftext ?? '',
        subreddit: c.data.subreddit,
        author: c.data.author,
        created_utc: c.data.created_utc,
        num_comments: c.data.num_comments,
        score: c.data.score,
        permalink: c.data.permalink,
        url: `${REDDIT_BASE}${c.data.permalink}`,
        sourceType: 'reddit-search' as const,
        sourceName: `Reddit · "${term}"`,
      }));
    })
  );

  const seen = new Set<string>();
  const all: RedditPost[] = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      r.value.forEach(p => {
        if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
      });
    }
  });
  return all.sort((a, b) => b.created_utc - a.created_utc);
}

export async function fetchAllSubreddits(enabledSubreddits: string[]): Promise<RedditPost[]> {
  const results = await Promise.allSettled(
    enabledSubreddits.map(name => fetchSubredditPosts(name))
  );
  const all: RedditPost[] = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all.push(...r.value);
  });
  return all.sort((a, b) => b.created_utc - a.created_utc);
}

export async function fetchDiscoverySubreddits(
  subreddits: string[],
  keywords: string[],
): Promise<RedditPost[]> {
  if (keywords.length === 0) return [];
  const lcKeywords = keywords.map(k => k.toLowerCase());

  const results = await Promise.allSettled(
    subreddits.map(name => fetchSubredditPosts(name))
  );

  const seen = new Set<string>();
  const matched: RedditPost[] = [];

  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    r.value.forEach(post => {
      const haystack = (post.title + ' ' + post.selftext).toLowerCase();
      const hit = lcKeywords.find(kw => haystack.includes(kw));
      if (!hit) return;
      const id = `disc_${post.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      matched.push({
        ...post,
        id,
        sourceType: 'reddit-discovery',
        sourceName: `r/${post.subreddit} · discovery`,
      });
    });
  });

  return matched.sort((a, b) => b.created_utc - a.created_utc);
}

export function scorePost(post: RedditPost, searchTerms: string[]): number {
  const ageHours = (Date.now() / 1000 - post.created_utc) / 3600;
  const recency = Math.max(0, 1 - ageHours / 72);

  const untouched =
    post.num_comments === 0 ? 2.5
    : post.num_comments <= 3 ? 1.5
    : post.num_comments <= 10 ? 1.0
    : 0.5;

  const titleLower = post.title.toLowerCase();
  const keywordBonus = searchTerms.some(t => titleLower.includes(t.toLowerCase())) ? 1.5 : 1.0;

  const sourceBonus =
    post.sourceType === 'reddit-search' ? 1.4
    : post.sourceType === 'reddit-discovery' ? 1.2
    : 1.0;

  return recency * untouched * keywordBonus * sourceBonus * 100;
}

export function getAgeHours(post: RedditPost): number {
  return (Date.now() / 1000 - post.created_utc) / 3600;
}

export function isUntouched(post: RedditPost): boolean {
  return post.num_comments === 0;
}

export function isNewAndUntouched(post: RedditPost): boolean {
  return getAgeHours(post) < 2 && post.num_comments === 0;
}

export function getTraction(post: RedditPost): 'UNTOUCHED' | 'LOW' | 'HOT' {
  if (post.num_comments === 0) return 'UNTOUCHED';
  if (post.num_comments <= 5) return 'LOW';
  return 'HOT';
}

export function formatTimeAgo(created_utc: number): string {
  const hours = (Date.now() / 1000 - created_utc) / 3600;
  if (hours < 1) return `${Math.floor(hours * 60)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
