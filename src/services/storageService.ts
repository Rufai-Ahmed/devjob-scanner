import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, RedditPost } from '../types';

const KEYS = {
  SEEN_POSTS: 'seen_post_ids',
  SETTINGS: 'app_settings',
  LAST_SCAN: 'last_scan_time',
  CACHED_POSTS: 'cached_posts',
};

const DEFAULT_SETTINGS: AppSettings = {
  enabledSubreddits: ["forhire", "WebDevJobs", "Programmers_forhire"],
  enabledSources: ["hn", "remoteok", "weworkremotely"],
  stackFilters: [],
  fetchInterval: 15,
  notificationsEnabled: true,
  aiProvider: "anthropic",
  anthropicApiKey: "",
  groqApiKey: "",
  geminiApiKey: "AIzaSyD4U7GH0KeXHgqDqVio8GJHc7diLLwIddk",
};

export async function getSeenPostIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SEEN_POSTS);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function addSeenPostIds(ids: string[]): Promise<void> {
  try {
    const existing = await getSeenPostIds();
    ids.forEach(id => existing.add(id));
    // Cap at 1000 to prevent unbounded growth
    const arr = Array.from(existing).slice(-1000);
    await AsyncStorage.setItem(KEYS.SEEN_POSTS, JSON.stringify(arr));
  } catch {}
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function getLastScanTime(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LAST_SCAN);
    if (!raw) return null;
    return new Date(raw);
  } catch {
    return null;
  }
}

export async function setLastScanTime(date: Date): Promise<void> {
  await AsyncStorage.setItem(KEYS.LAST_SCAN, date.toISOString());
}

export async function getCachedPosts(): Promise<RedditPost[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHED_POSTS);
    if (!raw) return [];
    return JSON.parse(raw) as RedditPost[];
  } catch {
    return [];
  }
}

export async function saveCachedPosts(posts: RedditPost[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CACHED_POSTS, JSON.stringify(posts.slice(0, 150)));
}
