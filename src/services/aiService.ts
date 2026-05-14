import { RedditPost, AppSettings, AIProvider } from '../types';
import { USER_PROFILE } from '../constants/profile';

function buildPrompt(post: RedditPost): string {
  const source = post.sourceName ?? `r/${post.subreddit}`;
  return `You are writing a job application reply on behalf of a developer.

Developer Profile:
${USER_PROFILE}

Job Posting:
Platform: ${source}
Title: ${post.title}
Content: ${post.selftext || '(No additional content — title only)'}

Write a concise, natural-sounding reply (2–3 short paragraphs) that:
1. Directly addresses what they're looking for
2. Highlights 2–3 specific skills or projects from the profile most relevant to this post
3. Mentions the portfolio link naturally
4. Sounds human, not templated
5. Ends with a clear call to action

Reply only — no preamble or "here is your reply" framing.`;
}

// Shown when there is no API key — no network call needed
export function getGenericReply(post: RedditPost): string {
  const source = post.sourceName ?? `r/${post.subreddit}`;
  return `Hi! I came across your post on ${source} and I think I'd be a great fit.

I'm Rufai Ahmed, a full-stack and mobile developer with 4+ years of experience. My core stack is React Native (Expo), Next.js, Node.js, TypeScript, and MongoDB. I've shipped buyer/vendor apps to both the Play Store and App Store, built fintech platforms with real-time transaction features, and created the Outsella Widget SDK — a cross-framework voice assistant published on npm and distributed via CDN.

You can see my work at ahmed.unicon.com.ng or github.com/Rufai-Ahmed. Feel free to DM — happy to share more!`;
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err?.error?.message ?? `Anthropic error ${res.status}`);
  }
  const data = await res.json() as any;
  return data.content[0].text as string;
}

async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
  }
  const data = await res.json() as any;
  return data.choices[0].message.content as string;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err?.error?.message ?? `Gemini error ${res.status}`);
  }
  const data = await res.json() as any;
  return data.candidates[0].content.parts[0].text as string;
}

function getApiKey(settings: AppSettings): string {
  switch (settings.aiProvider) {
    case 'anthropic': return settings.anthropicApiKey;
    case 'groq': return settings.groqApiKey;
    case 'gemini': return settings.geminiApiKey;
  }
}

export async function generateReply(post: RedditPost, settings: AppSettings): Promise<string> {
  const apiKey = getApiKey(settings);
  if (!apiKey) return getGenericReply(post);

  const prompt = buildPrompt(post);
  switch (settings.aiProvider) {
    case 'anthropic': return callAnthropic(apiKey, prompt);
    case 'groq': return callGroq(apiKey, prompt);
    case 'gemini': return callGemini(apiKey, prompt);
  }
}

export const AI_PROVIDER_INFO: Record<
  AIProvider,
  { label: string; placeholder: string; freeNote: string; docsUrl: string }
> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-api03-...',
    freeNote: 'Paid — starts at $5 credit',
    docsUrl: 'console.anthropic.com',
  },
  groq: {
    label: 'Groq · Llama 3.3 70B',
    placeholder: 'gsk_...',
    freeNote: 'Free tier — 30 req/min, no credit card',
    docsUrl: 'console.groq.com',
  },
  gemini: {
    label: 'Gemini 2.0 Flash',
    placeholder: 'AIzaSy...',
    freeNote: 'Free tier — 15 req/min, no credit card',
    docsUrl: 'aistudio.google.com',
  },
};
