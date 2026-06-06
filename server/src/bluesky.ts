import type { Post, LeadOpts } from './reddit';
import { batchMap, fetchWithTimeout } from './utils';

const MAX_AGE_MINUTES = 20;
const UA = 'DevJobScanner/2.0';

// The unauthenticated endpoint (public.api.bsky.app) IP-blocks datacenter
// hosts like Render. With BSKY_IDENTIFIER + BSKY_APP_PASSWORD set, we log
// in and search via bsky.social instead, which accepts authenticated calls.
let session: { jwt: string; expiresAt: number } | null = null;

async function getSession(): Promise<string | null> {
  const identifier = process.env.BSKY_IDENTIFIER;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!identifier || !password) return null;
  if (session && Date.now() < session.expiresAt) return session.jwt;
  try {
    const res = await fetchWithTimeout('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      console.error(`Bluesky login failed: ${res.status}`);
      return null;
    }
    const json = await res.json() as any;
    // accessJwt is valid ~2h; refresh after 1h to stay well clear
    session = { jwt: json.accessJwt, expiresAt: Date.now() + 60 * 60 * 1000 };
    console.log('Bluesky session created');
    return session.jwt;
  } catch (e) {
    console.error('Bluesky login error:', e);
    return null;
  }
}

export async function fetchBluesky(terms: string[], opts: LeadOpts = { idPrefix: 'bsky' }): Promise<Post[]> {
  const cutoffMs = Date.now() - MAX_AGE_MINUTES * 60_000;
  const jwt = await getSession();
  const base = jwt ? 'https://bsky.social' : 'https://public.api.bsky.app';
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const results = await batchMap(terms, async term => {
    try {
      const q = encodeURIComponent(`"${term}"`);
      const res = await fetchWithTimeout(`${base}/xrpc/app.bsky.feed.searchPosts?q=${q}&sort=latest&limit=25`, { headers });
      if (!res.ok) {
        if (res.status === 401) session = null; // force re-login next scan
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
