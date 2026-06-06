import type { Post } from './reddit';
import { fetchSearchLeads, fetchDiscovery } from './reddit';
import { fetchBluesky } from './bluesky';

// Recruitment scanning — people in Outlier-supported regions (UK etc.)
// looking for online/remote income. Fully separate from dev-lead scanning;
// disable with RECRUIT_ENABLED=false (on by default).

const RECRUIT_SUBREDDITS = ['beermoneyuk', 'beermoney', 'WorkOnline', 'sidehustle', 'remotework', 'UKJobs'];
const RECRUIT_TERMS = ['outlier ai', 'outlier.ai', 'data annotation', 'ai training jobs', 'make money online', 'work from home uk', 'remote side income', 'looking for online work'];

export function recruitEnabled(): boolean {
  return process.env.RECRUIT_ENABLED !== 'false';
}

export function recruitSources(): Record<string, Promise<Post[]>> {
  if (!recruitEnabled()) return {};
  return {
    redditRecruitSearch: fetchSearchLeads(RECRUIT_TERMS, { idPrefix: 'rec', recruit: true }),
    redditRecruitDiscovery: fetchDiscovery(RECRUIT_SUBREDDITS, RECRUIT_TERMS, { idPrefix: 'recd', recruit: true }),
    blueskyRecruit: fetchBluesky(RECRUIT_TERMS, { idPrefix: 'bskyrec', recruit: true }),
  };
}
