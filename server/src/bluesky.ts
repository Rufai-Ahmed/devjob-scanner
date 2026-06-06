import type { Post, LeadOpts } from './reddit';
import { batchMap, fetchWithTimeout } from './utils';

const MAX_AGE_MINUTES = 20;
const HEADERS = { 'User-Agent': 'DevJobScanner/2.0' };

// Bluesky public search — no auth required. May be IP-blocked on some
// networks; every failure is logged and returns [] so the scan continues.
export async function fetchBluesky(terms: string[], opts: LeadOpts = { idPrefix: 'bsky' }): Promise<Post[]> {
  const cutoffMs = Date.now() - MAX_AGE_MINUTES * 60_000;
  const results = await batchMap(terms, async term => {
    try {
      const q = encodeURIComponent(`"${term}"`);
      const res = await fetchWithTimeout(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${q}&sort=latest&limit=25`, { headers: HEADERS });
      if (!res.ok) {
        console.error(`Bluesky ${res.status} for "${term}"`);
        return [];
      }
      const json = await res.json() as any;
      const lcTerm = term.toLowerCase();
      return (json.posts ?? [])
        .filter((p: any) =>
          (p.record?.text ?? '').toLowerCase().includes(lcTerm) &&
          new Date(p.record?.createdAt ?? 0).getTime() > cutoffMs)
        .map((p: any): Post => {
          const rkey = p.uri?.split('/').pop() ?? p.cid;
          const handle = p.author?.handle ?? 'unknown';
          return {
            id: `${opts.idPrefix}_${rkey}`,
            title: (p.record.text as string).slice(0, 140),
            subreddit: handle,
            permalink: `https://bsky.app/profile/${handle}/post/${rkey}`,
            created_utc: new Date(p.record.createdAt).getTime() / 1000,
            num_comments: p.replyCount ?? 0,
            isLead: true,
            source: 'bluesky',
            recruit: opts.recruit,
          };
        });
    } catch (e) {
      console.error(`Bluesky fetch error for "${term}":`, e);
      return [];
    }
  });
  return results.flat();
}
