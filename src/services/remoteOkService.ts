import { RedditPost } from '../types';

function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEVEN_DAYS = 7 * 24 * 3600;

export async function fetchRemoteOKJobs(): Promise<RedditPost[]> {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'DevJobScanner/1.0 (personal app)' },
  });
  const data = await res.json() as any[];

  // First element is a metadata header — skip it
  const jobs = data.slice(1).filter(j => j.position && j.epoch) as any[];
  const cutoff = Date.now() / 1000 - SEVEN_DAYS;

  return jobs
    .filter(j => j.epoch > cutoff)
    .map(j => ({
      id: `rok_${j.id ?? j.slug ?? String(j.epoch)}`,
      title: `[${j.company ?? 'Company'}] ${j.position}`,
      selftext: stripHtml(j.description ?? ''),
      subreddit: 'remoteok',
      sourceName: 'RemoteOK',
      sourceType: 'remoteok' as const,
      author: j.company ?? 'Unknown',
      created_utc: j.epoch as number,
      num_comments: j.applicants ?? 0,
      score: 0,
      permalink: j.url ?? `https://remoteok.com/remote-jobs/${j.slug}`,
      url: j.url ?? `https://remoteok.com/remote-jobs/${j.slug}`,
    }));
}
