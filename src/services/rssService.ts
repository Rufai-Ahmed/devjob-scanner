import { RedditPost } from '../types';

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const cm = block.match(cdataRe);
  if (cm) return stripCdata(cm[1]);
  const pm = block.match(plainRe);
  return pm ? pm[1].trim() : '';
}

function parseRSSItems(xml: string) {
  const items: { title: string; link: string; description: string; pubDate: string; guid: string }[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    items.push({
      title: stripHtml(extractTag(b, 'title')),
      link: extractTag(b, 'link'),
      description: stripHtml(extractTag(b, 'description')),
      pubDate: extractTag(b, 'pubDate'),
      guid: extractTag(b, 'guid'),
    });
  }
  return items;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36);
}

export async function fetchWWRJobs(): Promise<RedditPost[]> {
  const res = await fetch(
    'https://weworkremotely.com/categories/remote-programming-jobs.rss',
    { headers: { 'User-Agent': 'DevJobScanner/1.0 (personal app)' } }
  );
  const xml = await res.text();
  const items = parseRSSItems(xml);

  return items.map(item => {
    const pubDate = item.pubDate ? new Date(item.pubDate).getTime() / 1000 : Date.now() / 1000;
    const raw = item.guid || item.link || item.title;
    return {
      id: `wwr_${simpleHash(raw)}`,
      title: item.title,
      selftext: item.description,
      subreddit: 'weworkremotely',
      sourceName: 'We Work Remotely',
      sourceType: 'weworkremotely' as const,
      author: 'WWR',
      created_utc: pubDate,
      num_comments: 0,
      score: 0,
      permalink: item.link,
      url: item.link,
    };
  });
}
