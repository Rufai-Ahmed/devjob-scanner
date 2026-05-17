import { RedditPost, AppSettings } from '../types';
import { fetchAllSubreddits, fetchDiscoverySubreddits, fetchRedditSearch, scorePost } from './redditService';
import { fetchHNJobs } from './hnService';
import { fetchRemoteOKJobs } from './remoteOkService';
import { fetchWWRJobs } from './rssService';

export async function fetchAllJobs(settings: AppSettings): Promise<RedditPost[]> {
  const tasks: Promise<RedditPost[]>[] = [];

  if (settings.enabledSubreddits.length > 0) {
    tasks.push(fetchAllSubreddits(settings.enabledSubreddits));
  }
  if (settings.enabledSources?.includes('hn')) tasks.push(fetchHNJobs());
  if (settings.enabledSources?.includes('remoteok')) tasks.push(fetchRemoteOKJobs());
  if (settings.enabledSources?.includes('weworkremotely')) tasks.push(fetchWWRJobs());
  if (settings.searchEnabled && settings.searchTerms?.length > 0) {
    tasks.push(fetchRedditSearch(settings.searchTerms));
  }
  if (settings.discoveryEnabled && settings.discoverySubreddits?.length > 0 && settings.searchTerms?.length > 0) {
    tasks.push(fetchDiscoverySubreddits(settings.discoverySubreddits, settings.searchTerms));
  }

  const results = await Promise.allSettled(tasks);
  const all: RedditPost[] = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all.push(...r.value);
    else console.error('[jobService] Source failed:', r.reason);
  });

  const terms = settings.searchTerms ?? [];
  return all
    .map(p => ({ ...p, leadScore: scorePost(p, terms) }))
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0));
}
