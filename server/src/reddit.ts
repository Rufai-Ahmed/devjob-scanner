const BASE = 'https://www.reddit.com';
const HEADERS = { 'User-Agent': 'DevJobScanner/1.0' };
const MAX_AGE_MINUTES = 14;

export interface Post {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  created_utc: number;
  num_comments: number;
  isLead: boolean;
}

async function redditGet(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const json = await res.json() as any;
    return json.data?.children?.map((c: any) => c.data) ?? [];
  } catch {
    return [];
  }
}

function isFresh(p: any): boolean {
  return (Date.now() / 1000 - p.created_utc) / 60 < MAX_AGE_MINUTES && p.num_comments === 0;
}

function toPost(p: any, id: string, isLead: boolean): Post {
  return { id, title: p.title, subreddit: p.subreddit, permalink: p.permalink, created_utc: p.created_utc, num_comments: p.num_comments, isLead };
}

export async function fetchJobBoards(subreddits: string[]): Promise<Post[]> {
  const results = await Promise.all(
    subreddits.map(sub => redditGet(`${BASE}/r/${sub}/new.json?limit=25&raw_json=1`))
  );
  return results.flat().filter(isFresh).map(p => toPost(p, p.id, false));
}

export async function fetchSearchLeads(terms: string[]): Promise<Post[]> {
  const results = await Promise.all(
    terms.map(async term => {
      const q = encodeURIComponent(`title:"${term}"`);
      const posts = await redditGet(`${BASE}/search.json?q=${q}&sort=new&t=hour&limit=25&raw_json=1`);
      return posts
        .filter(p => p.title.toLowerCase().includes(term.toLowerCase()) && isFresh(p))
        .map(p => toPost(p, `search_${p.id}`, true));
    })
  );
  return results.flat();
}

export async function fetchDiscovery(subreddits: string[], keywords: string[]): Promise<Post[]> {
  if (!keywords.length) return [];
  const lc = keywords.map(k => k.toLowerCase());
  const results = await Promise.all(
    subreddits.map(sub => redditGet(`${BASE}/r/${sub}/new.json?limit=25&raw_json=1`))
  );
  return results.flat()
    .filter(p => lc.some(kw => p.title.toLowerCase().includes(kw)) && isFresh(p))
    .map(p => toPost(p, `disc_${p.id}`, true));
}
