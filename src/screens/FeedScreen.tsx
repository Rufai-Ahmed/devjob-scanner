import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { FeedStackParamList, RedditPost } from '../types';
import PostCard from '../components/PostCard';
import { isNewAndUntouched } from '../services/redditService';
import { fetchAllJobs } from '../services/jobService';
import {
  getSettings,
  getLastScanTime,
  saveCachedPosts,
  getCachedPosts,
  setLastScanTime,
  getSeenPostIds,
  addSeenPostIds,
} from '../services/storageService';
import { sendJobNotification } from '../services/notificationService';

type NavProp = NativeStackNavigationProp<FeedStackParamList, 'FeedList'>;

function formatLastScan(date: Date | null): string {
  if (!date) return 'Never scanned';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FeedScreen() {
  const navigation = useNavigation<NavProp>();
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    const [cached, scanTime] = await Promise.all([getCachedPosts(), getLastScanTime()]);
    if (cached.length > 0) setPosts(cached);
    setLastScan(scanTime);
    setLoading(false);
    doRefresh();
  }

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const settings = await getSettings();
      const fetched = await fetchAllJobs(settings);
      const seenIds = await getSeenPostIds();

      const newUntouched = fetched.filter(p => !seenIds.has(p.id) && isNewAndUntouched(p));

      if (settings.notificationsEnabled) {
        for (const post of newUntouched.slice(0, 2)) {
          await sendJobNotification(post);
        }
      }

      await addSeenPostIds(fetched.map(p => p.id));
      await saveCachedPosts(fetched);

      const now = new Date();
      await setLastScanTime(now);
      setLastScan(now);
      setPosts(fetched);
    } catch (err) {
      console.error('[Feed] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>DevJob Scanner</Text>
          <Text style={styles.scanTime}>Last scan: {formatLastScan(lastScan)}</Text>
        </View>
        <TouchableOpacity
          onPress={doRefresh}
          style={[styles.scanButton, refreshing && styles.scanButtonDisabled]}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <Text style={styles.scanButtonText}>{refreshing ? '⟳ ...' : '⟳ Scan'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => navigation.navigate('PostDetail', { post: item })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Tap Scan or pull down to fetch jobs</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.accent,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  scanTime: {
    color: Colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    marginTop: 3,
  },
  scanButton: {
    backgroundColor: Colors.accent + '1a',
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonText: {
    color: Colors.accent,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 14,
  },
  emptyText: {
    color: Colors.textMuted,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 16,
  },
  emptySubtext: {
    color: Colors.textSubtle,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    marginTop: 8,
  },
});
