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
