import type { Post } from './reddit';
import { batchMap } from './utils';

const MAX_AGE_MINUTES = 20;
const HEADERS = { 'User-Agent': 'DevJobScanner/1.0' };

const CITIES = [
  'newyork', 'losangeles', 'chicago', 'sfbay', 'seattle',
  'austin', 'boston', 'atlanta', 'london', 'toronto',
];

function parseItems(xml: string): Array<{ title: string; link: string; date: string }> {
  const items: Array<{ title: string; link: string; date: string }> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1] ?? '';
    const link = /<link>(.*?)<\/link>/.exec(block)?.[1]?.trim() ?? '';
    const date = /<dc:date>(.*?)<\/dc:date>/.exec(block)?.[1] ?? '';
    if (title && link) items.push({ title, link, date });
  }
  return items;
}

function extractId(url: string): string {
  return /\/(\d+)\.html/.exec(url)?.[1] ?? url;
}

function isRecent(dateStr: string): boolean {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) / 60000 < MAX_AGE_MINUTES;
}

export async function fetchCraigslist(keywords: string[]): Promise<Post[]> {
  const lc = keywords.map(k => k.toLowerCase());

  const results = await batchMap(CITIES, async city => {
      try {
        const res = await fetch(`https://${city}.craigslist.org/search/cpg?format=rss`, { headers: HEADERS });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseItems(xml)
          .filter(item => lc.some(kw => item.title.toLowerCase().includes(kw)) && isRecent(item.date))
          .map(item => ({
            id: `cl_${extractId(item.link)}`,
            title: item.title,
            subreddit: city,
            permalink: item.link,
            created_utc: new Date(item.date).getTime() / 1000,
            num_comments: 0,
            isLead: true,
            source: 'craigslist' as const,
          }));
      } catch {
        return [];
      }
  });

  return results.flat();
}
