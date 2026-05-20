import { SeenPost } from './db';
import { fetchJobBoards, fetchSearchLeads, fetchDiscovery, type Post } from './reddit';
import { notifyAll } from './push';

const JOB_SUBREDDITS = ['forhire', 'freelance', 'slavelabour', 'hiring'];
const DISCOVERY_SUBREDDITS = ['entrepreneur', 'smallbusiness', 'startups', 'SideProject', 'webdev'];
const SEARCH_TERMS = ['need a developer', 'looking for developer', 'hire a developer', 'need a website', 'need website', 'looking for freelancer', 'need freelancer', 'need a freelancer'];

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

export async function runScan(): Promise<void> {
  const [boards, leads, discovery] = await Promise.all([
    fetchJobBoards(JOB_SUBREDDITS).then(r => { console.log(`Boards (post-filter): ${r.length}`); return r; }),
    fetchSearchLeads(SEARCH_TERMS).then(r => { console.log(`Leads (post-filter): ${r.length}`); return r; }),
    fetchDiscovery(DISCOVERY_SUBREDDITS, SEARCH_TERMS).then(r => { console.log(`Discovery (post-filter): ${r.length}`); return r; }),
  ]);

  const all = [...boards, ...leads, ...discovery];
  console.log(`Total found: ${all.length}`);
  const unseen = await filterUnseen(all);
  console.log(`Unseen: ${unseen.length}`);
  if (unseen.length) await notifyAll(unseen);
}
