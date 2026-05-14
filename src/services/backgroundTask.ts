import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { isNewAndUntouched } from './redditService';
import { fetchAllJobs } from './jobService';
import {
  getSeenPostIds,
  addSeenPostIds,
  getSettings,
  setLastScanTime,
  saveCachedPosts,
  getCachedPosts,
} from './storageService';
import { sendJobNotification } from './notificationService';
import { BACKGROUND_TASK_NAME } from '../constants/subreddits';

// Must be defined at module level — runs even when app is closed
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEnabled) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const posts = await fetchAllJobs(settings);
    const seenIds = await getSeenPostIds();

    const newUntouched = posts.filter(p => !seenIds.has(p.id) && isNewAndUntouched(p));

    await addSeenPostIds(posts.map(p => p.id));

    const existing = await getCachedPosts();
    const existingIds = new Set(existing.map(p => p.id));
    const merged = [
      ...posts.filter(p => !existingIds.has(p.id)),
      ...existing,
    ].slice(0, 150);
    await saveCachedPosts(merged);
    await setLastScanTime(new Date());

    // Cap at 3 notifications per cycle to avoid spam
    for (const post of newUntouched.slice(0, 3)) {
      await sendJobNotification(post);
    }

    return newUntouched.length > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.error('[BGTask] Error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask(intervalMinutes: 15 | 30 | 60 = 15): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
    }
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: intervalMinutes * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    console.error('[BGTask] Registration failed:', err);
  }
}

export async function unregisterBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
  } catch {}
}
