import { SERVER_URL } from '../constants/server';
import { RedditPost } from '../types';

// Recruit prospects are scanned server-side and kept for 7 days — the app
// just pulls the list. Returns null on network failure so callers can keep
// the cached list instead of clearing it.
export async function fetchRecruits(): Promise<RedditPost[] | null> {
  try {
    const res = await fetch(`${SERVER_URL}/recruits`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json.posts ?? []) as RedditPost[];
  } catch {
    return null;
  }
}
