import { Device } from './db';
import type { Post } from './reddit';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function buildMessage(post: Post) {
  const title = post.isLead
    ? `🔥 New lead in r/${post.subreddit}`
    : `🟢 Untouched in r/${post.subreddit}`;
  return { title, body: post.title, data: { permalink: post.permalink } };
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
    chunks.map(async chunk => {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const json = await res.json();
      console.log('Expo push response:', JSON.stringify(json));
    })
  );
}
