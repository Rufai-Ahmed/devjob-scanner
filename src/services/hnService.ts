import { RedditPost } from '../types';

const ALGOLIA = 'https://hn.algolia.com/api/v1';

function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(text: string): string {
  const first = text.split('\n')[0].trim();
  if (first.length > 10 && first.length <= 130) return first;
  return text.length > 110 ? text.slice(0, 110) + '…' : text;
}

export async function fetchHNJobs(): Promise<RedditPost[]> {
  // Find the latest "Who is Hiring" story
  const searchRes = await fetch(
    `${ALGOLIA}/search?query=Ask+HN+Who+is+hiring&tags=story&hitsPerPage=5`,
    { headers: { 'User-Agent': 'DevJobScanner/1.0' } }
  );
  const searchData = await searchRes.json() as { hits: any[] };

  const story = searchData.hits?.find(
    (h: any) =>
      typeof h.title === 'string' &&
      h.title.toLowerCase().includes('who is hiring')
  );
  if (!story) return [];

  // Fetch top-level comments — each one IS a job post
  const commentsRes = await fetch(
    `${ALGOLIA}/search?tags=comment,story_${story.objectID}&hitsPerPage=200`,
    { headers: { 'User-Agent': 'DevJobScanner/1.0' } }
  );
  const commentsData = await commentsRes.json() as { hits: any[] };

  return (commentsData.hits as any[])
    .filter(c => c.comment_text && c.author && !c.parent_id)
    .map(c => {
      const clean = stripHtml(c.comment_text as string);
      return {
        id: `hn_${c.objectID}`,
        title: extractTitle(clean),
        selftext: clean,
        subreddit: 'hackernews',
        sourceName: 'Hacker News',
        sourceType: 'hn' as const,
        author: c.author as string,
        created_utc: c.created_at_i as number,
        num_comments: 0,
        score: c.points ?? 0,
        permalink: `https://news.ycombinator.com/item?id=${c.objectID}`,
        url: `https://news.ycombinator.com/item?id=${c.objectID}`,
      };
    });
}
