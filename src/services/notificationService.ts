import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { RedditPost } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('job-alerts', {
      name: 'Job Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00ff88',
      sound: 'default',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function sendJobNotification(post: RedditPost): Promise<void> {
  const isLead = post.sourceType === 'reddit-search';
  const title = isLead
    ? `🔥 New lead in r/${post.subreddit}`
    : `🟢 Untouched in r/${post.subreddit}`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: post.title,
      data: { post: JSON.stringify(post) },
      sound: 'default',
    },
    trigger: null,
  });
}

export async function getPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}
