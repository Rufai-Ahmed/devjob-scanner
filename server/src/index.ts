import express from 'express';
import cron from 'node-cron';
import { connectDB, Device } from './db';
import { runScan } from './scanner';

const app = express();
app.use(express.json());

app.post('/register', async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: 'token required' });
  await Device.findOneAndUpdate({ token }, { token, updatedAt: new Date() }, { upsert: true });
  res.json({ ok: true });
});

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/devices', async (_req, res) => {
  const devices = await Device.find({}, 'token updatedAt').lean();
  res.json({ count: devices.length, devices });
});

app.post('/scan', async (_req, res) => {
  res.json({ ok: true, message: 'Scan triggered — check logs' });
  try {
    await runScan();
  } catch (e) {
    console.error('Manual scan error', e);
  }
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
  }]);
  res.json({ ok: true, message: 'Test push sent — check logs and your phone' });
});

async function start() {
  await connectDB();
  console.log('DB connected');

  cron.schedule('*/15 * * * *', async () => {
    console.log('Scan started', new Date().toISOString());
    try {
      await runScan();
      console.log('Scan done');
    } catch (e) {
      console.error('Scan error', e);
    }
  });

  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start().catch(console.error);
