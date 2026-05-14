import { RedditPost, AppSettings, AIProvider } from '../types';
import { USER_PROFILE } from '../constants/profile';

function buildPrompt(post: RedditPost): string {
  const source = post.sourceName ?? `r/${post.subreddit}`;
  return `Write a job application reply for this posting. Keep it to 3–5 sentences total — no long paragraphs.

Developer Profile:
${USER_PROFILE}

Job Posting (${source}):
Title: ${post.title}
${post.selftext ? `Details: ${post.selftext.slice(0, 600)}` : ''}

Rules:
- Read the post carefully. Address their specific tech stack or requirements by name.
- Pick only the 1–2 most relevant skills/projects — do not list everything.
- If the post mentions a tech you know (e.g. React Native, Next.js, Node), say you've shipped something with it specifically.
- End with a short CTA (DM, check portfolio, etc.). Portfolio: ahmed.unicon.com.ng
- No generic opener like "Hi, I saw your post". Jump straight to the value.
- Sound like a developer talking to another developer, not a cover letter.

Reply only — no quotes, labels, or preamble.`;
}

// Shown when there is no API key — no network call needed
export function getGenericReply(post: RedditPost): string {
  return `Full-stack and mobile dev with 4+ years — React Native (Expo), Next.js, Node.js, TypeScript, MongoDB. I've shipped production apps to the Play Store and App Store, built fintech platforms, and authored a cross-framework SDK on npm.

Portfolio: ahmed.unicon.com.ng · GitHub: github.com/Rufai-Ahmed — happy to share more if this looks like a fit.`;
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
      max_tokens: 280,
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
      max_tokens: 280,
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
