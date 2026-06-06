import { SeenPost } from './db';
import { fetchJobBoards, fetchSearchLeads, fetchDiscovery, type Post } from './reddit';
import { fetchCraigslist } from './craigslist';
import { fetchHN } from './hn';
import { fetchBluesky } from './bluesky';
import { recruitSources } from './recruit';
import { notifyAll } from './push';

const JOB_SUBREDDITS = ['forhire', 'WebDevJobs', 'Programmers_forhire', 'freelance', 'slavelabour', 'hiring'];
const DISCOVERY_SUBREDDITS = ['entrepreneur', 'smallbusiness', 'startups', 'SideProject', 'webdev', 'digitalnomad', 'ecommerce', 'agency'];
const SEARCH_TERMS = ['need a developer', 'need a mobile app', 'need web developer', 'looking for developer', 'looking for a developer', 'hire a developer', 'need a website', 'need website', 'looking for freelancer', 'need freelancer', 'need a freelancer'];

// Per-source counts from the last scan, surfaced via /health so it's easy
// to see which sources actually work from this host.
export let lastScan: { at: string; durationMs: number; counts: Record<string, number> } | null = null;

export async function runScan(): Promise<void> {
  const started = Date.now();
  const sources: Record<string, Promise<Post[]>> = {
    redditBoards: fetchJobBoards(JOB_SUBREDDITS),
    redditSearch: fetchSearchLeads(SEARCH_TERMS),
    redditDiscovery: fetchDiscovery(DISCOVERY_SUBREDDITS, SEARCH_TERMS),
    craigslist: fetchCraigslist(SEARCH_TERMS),
    hn: fetchHN(SEARCH_TERMS),
    bluesky: fetchBluesky(SEARCH_TERMS),
    ...recruitSources(),
  };

  const names = Object.keys(sources);
  const settled = await Promise.all(Object.values(sources));

  const counts: Record<string, number> = {};
  names.forEach((name, i) => { counts[name] = settled[i].length; });

  const all = settled.flat();
  const unseen = await filterUnseen(all);

  lastScan = { at: new Date().toISOString(), durationMs: Date.now() - started, counts };
  console.log('Scan counts:', JSON.stringify(counts), `— ${unseen.length} new`);

  if (unseen.length) await notifyAll(unseen);
}

async function filterUnseen(posts: Post[]): Promise<Post[]> {
  const ids = posts.map(p => p.id);
  const seen = await SeenPost.find({ postId: { $in: ids } }, 'postId').lean();
  const seenSet = new Set(seen.map(s => s.postId));

  const fresh = posts.filter(p => !seenSet.has(p.id));
  if (fresh.length) {
    await SeenPost.insertMany(fresh.map(p => ({ postId: p.id })), { ordered: false }).catch(() => {});
  }
  return fresh;
}
