import { SeenPost } from './db';
import { fetchJobBoards, fetchSearchLeads, fetchDiscovery, type Post } from './reddit';
import { fetchCraigslist } from './craigslist';
import { notifyAll } from './push';

const JOB_SUBREDDITS = ['forhire', 'WebDevJobs', 'Programmers_forhire', 'freelance', 'slavelabour', 'hiring'];
const DISCOVERY_SUBREDDITS = ['entrepreneur', 'smallbusiness', 'startups', 'SideProject', 'webdev', 'digitalnomad', 'ecommerce', 'agency'];
const SEARCH_TERMS = ['need a developer', 'need a mobile app', 'need web developer', 'looking for developer', 'looking for a developer', 'hire a developer', 'need a website', 'need website', 'looking for freelancer', 'need freelancer', 'need a freelancer'];

// Recruit scan: people in Outlier-supported regions (UK etc.) looking for online/remote income.
const RECRUIT_SUBREDDITS = ['beermoneyuk', 'beermoney', 'WorkOnline', 'sidehustle', 'remotework', 'UKJobs'];
const RECRUIT_TERMS = ['outlier ai', 'outlier.ai', 'data annotation', 'ai training jobs', 'make money online', 'work from home uk', 'remote side income', 'looking for online work'];

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
  const [boards, leads, discovery, craigslist, recruitSearch, recruitDisc] = await Promise.all([
    fetchJobBoards(JOB_SUBREDDITS),
    fetchSearchLeads(SEARCH_TERMS),
    fetchDiscovery(DISCOVERY_SUBREDDITS, SEARCH_TERMS),
    fetchCraigslist(SEARCH_TERMS),
    fetchSearchLeads(RECRUIT_TERMS, { idPrefix: 'rec', recruit: true }),
    fetchDiscovery(RECRUIT_SUBREDDITS, RECRUIT_TERMS, { idPrefix: 'recd', recruit: true }),
  ]);

  const all = [...boards, ...leads, ...discovery, ...craigslist, ...recruitSearch, ...recruitDisc];
  const unseen = await filterUnseen(all);
  if (unseen.length) await notifyAll(unseen);
}
