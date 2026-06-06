import express from 'express';
import cron from 'node-cron';
import { connectDB, Device, RecruitPost } from './db';
import { runScan, lastScan } from './scanner';
import { recruitEnabled } from './recruit';

const app = express();
app.use(express.json({ limit: '16kb' }));

// Guard against overlapping scans — a hung scan must not stack new ones on top.
let scanning = false;
async function safeScan(trigger: string): Promise<void> {
  if (scanning) {
    console.warn(`Scan (${trigger}) skipped — previous scan still running`);
    return;
  }
  scanning = true;
  const started = Date.now();
  try {
    await runScan();
    console.log(`Scan (${trigger}) done in ${Date.now() - started}ms`);
  } catch (e) {
    console.error(`Scan (${trigger}) error:`, e);
  } finally {
    scanning = false;
  }
}

app.post('/register', async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: 'token required' });
  await Device.findOneAndUpdate({ token }, { token, updatedAt: new Date() }, { upsert: true });
  res.json({ ok: true });
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  time: new Date().toISOString(),
  memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  recruitEnabled: recruitEnabled(),
  lastScan,
}));

app.get('/recruits', async (_req, res) => {
  const items = await RecruitPost.find({}).sort({ created_utc: -1 }).limit(100).lean();
  res.json({
    count: items.length,
    posts: items.map(r => ({
      id: r.postId,
      title: r.title,
      selftext: '',
      subreddit: r.subreddit,
      author: '',
      created_utc: r.created_utc,
      num_comments: 0,
      score: 0,
      permalink: r.permalink,
      url: r.url,
      sourceType: r.source === 'reddit' ? 'reddit-search' : r.source,
      sourceName: r.source === 'hn' ? 'Hacker News' : r.source === 'bluesky' ? 'Bluesky' : undefined,
      recruit: true,
    })),
  });
});

app.get('/devices', async (_req, res) => {
  const devices = await Device.find({}, 'token updatedAt').lean();
  res.json({ count: devices.length, devices });
});

app.post('/scan', (_req, res) => {
  res.json({ ok: true, message: 'Scan triggered — check logs' });
  void safeScan('manual');
});

app.post('/test-push', async (_req, res) => {
  const { notifyAll } = await import('./push');
  await notifyAll([{
    id: 'test',
    title: 'Need a developer for my startup ASAP',
    subreddit: 'entrepreneur',
    permalink: '/r/entrepreneur/test',
    created_utc: Date.now() / 1000,
    num_comments: 0,
    isLead: true,
    source: 'reddit',
  }]);
  res.json({ ok: true, message: 'Test push sent — check logs and your phone' });
});

async function start() {
  await connectDB();
  console.log('DB connected');

  cron.schedule('*/15 * * * *', () => {
    console.log('Scan started', new Date().toISOString());
    void safeScan('cron');
  });

  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

process.on('unhandledRejection', e => console.error('Unhandled rejection:', e));
process.on('uncaughtException', e => console.error('Uncaught exception:', e));

start().catch(e => {
  console.error('Startup failed:', e);
  process.exit(1);
});
