import type { Post } from './reddit';
import { fetchSearchLeads, fetchDiscovery } from './reddit';
import { fetchBluesky } from './bluesky';

// Recruitment scanning — UK/EU students looking for online income, to be
// referred to Outlier via referral link (signup is free; Outlier pays the
// referral bonus). Fully separate from dev-lead scanning; disable with
// RECRUIT_ENABLED=false (on by default).
//
// Note: Outlier requires 18+, so deliberately no under-18-skewing
// subreddits (r/sixthform, r/GCSE, etc.).

const RECRUIT_SUBREDDITS = ['beermoneyuk', 'beermoney', 'WorkOnline', 'UniUK', 'students', 'Erasmus', 'UKJobs'];
const RECRUIT_TERMS = ['outlier ai', 'outlier.ai', 'data annotation', 'ai training jobs', 'broke student', 'student side hustle', 'part time job uk', 'need money for uni', 'student looking for work', 'make money online', 'work from home uk'];

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
