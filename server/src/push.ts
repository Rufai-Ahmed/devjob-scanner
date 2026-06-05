import { Device } from './db';
import type { Post } from './reddit';
import { fetchWithTimeout } from './utils';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

function buildMessage(post: Post) {
  const isCL = post.source === 'craigslist';
  const title = post.recruit
    ? `🎯 Recruit prospect in r/${post.subreddit}`
    : isCL
      ? `🔥 New lead on Craigslist (${post.subreddit})`
      : post.isLead
        ? `🔥 New lead in r/${post.subreddit}`
        : `🟢 Untouched in r/${post.subreddit}`;
  const appPost = {
    id: post.id,
    title: post.title,
    selftext: '',
    subreddit: post.subreddit,
    author: '',
    created_utc: post.created_utc,
    num_comments: post.num_comments,
    score: 0,
    permalink: post.permalink,
    url: isCL ? post.permalink : `https://www.reddit.com${post.permalink}`,
    sourceType: isCL ? 'craigslist' : post.isLead ? 'reddit-search' : 'reddit',
  };
  return { title, body: post.title, data: { post: JSON.stringify(appPost) } };
}

export async function notifyAll(posts: Post[]): Promise<void> {
  if (!posts.length) return;

  const devices = await Device.find({}, 'token').lean();
  if (!devices.length) return;

  const messages = devices.flatMap(d =>
    posts.map(post => ({ to: d.token, sound: 'default', ...buildMessage(post) }))
  );

  const deadTokens = new Set<string>();

  // Send chunks sequentially — bounds memory and avoids hammering Expo.
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetchWithTimeout(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => null) as any;
      const tickets: any[] = json?.data ?? [];
      tickets.forEach((t, idx) => {
        if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered') {
          deadTokens.add(chunk[idx].to);
        }
      });
    } catch (e) {
      console.error('Push chunk failed:', e);
    }
  }

  if (deadTokens.size) {
    await Device.deleteMany({ token: { $in: [...deadTokens] } }).catch(() => {});
    console.log(`Pruned ${deadTokens.size} dead push token(s)`);
  }
}
