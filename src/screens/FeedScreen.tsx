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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { FeedStackParamList, LeadStatus, RedditPost } from '../types';
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
  getLeadStatuses,
} from '../services/storageService';
import { sendJobNotification } from '../services/notificationService';

type NavProp = NativeStackNavigationProp<FeedStackParamList, 'FeedList'>;
type Filter = 'all' | 'leads' | 'interested' | 'replied';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'leads', label: 'Leads' },
  { key: 'interested', label: 'Interested' },
  { key: 'replied', label: 'Replied' },
];

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
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  useEffect(() => {
    loadInitial();
  }, []);

  // Reload statuses whenever screen comes back into focus (after detail screen changes)
  useFocusEffect(useCallback(() => {
    getLeadStatuses().then(setStatuses);
  }, []));

  async function loadInitial() {
    const [cached, scanTime, savedStatuses] = await Promise.all([
      getCachedPosts(),
      getLastScanTime(),
      getLeadStatuses(),
    ]);
    if (cached.length > 0) setPosts(cached);
    setLastScan(scanTime);
    setStatuses(savedStatuses);
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

  const filteredPosts = posts.filter(p => {
    if (filter === 'leads') {
      return p.sourceType === 'reddit-search' || p.sourceType === 'reddit-discovery';
    }
    if (filter === 'interested') return statuses[p.id] === 'interested';
    if (filter === 'replied') return statuses[p.id] === 'replied';
    return true;
  });

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

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const count = f.key === 'all' ? posts.length
            : f.key === 'leads' ? posts.filter(p => p.sourceType === 'reddit-search' || p.sourceType === 'reddit-discovery').length
            : posts.filter(p => statuses[p.id] === f.key).length;
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, active && styles.filterTabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                {f.label}
                {count > 0 ? ` ${count}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              status={statuses[item.id]}
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
          contentContainerStyle={filteredPosts.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyText}>
                {filter === 'all' ? 'No posts yet' : `No ${filter} posts`}
              </Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all' ? 'Tap Scan or pull down to fetch jobs' : 'Pull down to refresh the feed'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  scanButtonDisabled: { opacity: 0.5 },
  scanButtonText: {
    color: Colors.accent,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterTabActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '1a',
  },
  filterTabText: {
    color: Colors.textMuted,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  filterTabTextActive: { color: Colors.accent },
  listContent: { paddingTop: 8, paddingBottom: 24 },
  emptyContainer: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyIcon: { fontSize: 42, marginBottom: 14 },
  emptyText: { color: Colors.textMuted, fontFamily: 'SpaceMono_700Bold', fontSize: 16 },
  emptySubtext: {
    color: Colors.textSubtle,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    marginTop: 8,
  },
});
