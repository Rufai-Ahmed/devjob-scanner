import type { Post } from './reddit';
import { batchMap, fetchWithTimeout } from './utils';

const MAX_AGE_MINUTES = 20;

// Hacker News via Algolia — free, no auth, not IP-blocked.
export async function fetchHN(terms: string[]): Promise<Post[]> {
  const cutoff = Math.floor(Date.now() / 1000) - MAX_AGE_MINUTES * 60;
  const results = await batchMap(terms, async term => {
    try {
      const q = encodeURIComponent(`"${term}"`);
      const res = await fetchWithTimeout(`https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=(story,comment)&numericFilters=created_at_i>${cutoff}&hitsPerPage=25`);
      if (!res.ok) {
        console.error(`HN ${res.status} for "${term}"`);
        return [];
      }
      const json = await res.json() as any;
      const lcTerm = term.toLowerCase();
      return (json.hits ?? [])
        .filter((h: any) => `${h.title ?? ''} ${h.comment_text ?? ''}`.toLowerCase().includes(lcTerm))
        .map((h: any): Post => ({
          id: `hn_${h.objectID}`,
          title: h.title ?? (h.comment_text ?? '').replace(/<[^>]+>/g, '').slice(0, 140),
          subreddit: 'hackernews',
          permalink: `https://news.ycombinator.com/item?id=${h.objectID}`,
          created_utc: h.created_at_i,
          num_comments: h.num_comments ?? 0,
          isLead: true,
          source: 'hn',
        }));
    } catch (e) {
      console.error(`HN fetch error for "${term}":`, e);
      return [];
    }
  });
  return results.flat();
}
