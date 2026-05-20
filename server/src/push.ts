import { Device } from './db';
import type { Post } from './reddit';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function buildMessage(post: Post) {
  const title = post.isLead
    ? `🔥 New lead in r/${post.subreddit}`
    : `🟢 Untouched in r/${post.subreddit}`;
  const redditPost = {
    id: post.id,
    title: post.title,
    selftext: '',
    subreddit: post.subreddit,
    author: '',
    created_utc: post.created_utc,
    num_comments: post.num_comments,
    score: 0,
    permalink: post.permalink,
    url: `https://www.reddit.com${post.permalink}`,
    sourceType: post.isLead ? 'reddit-search' : 'reddit',
  };
  return { title, body: post.title, data: { post: JSON.stringify(redditPost) } };
}

export async function notifyAll(posts: Post[]): Promise<void> {
  if (!posts.length) return;

  const devices = await Device.find({}, 'token').lean();
  if (!devices.length) return;

  const messages = devices.flatMap(d =>
    posts.map(post => ({ to: d.token, sound: 'default', ...buildMessage(post) }))
  );

  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  await Promise.all(
    chunks.map(chunk =>
      fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      })
    )
  );
}
