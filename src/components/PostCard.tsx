import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RedditPost } from '../types';
import { Colors } from '../constants/colors';
import { getTraction, formatTimeAgo, isUntouched } from '../services/redditService';

interface Props {
  post: RedditPost;
  onPress: () => void;
}

const TRACTION_CONFIG = {
  UNTOUCHED: { emoji: '🟢', label: 'UNTOUCHED', color: Colors.untouched },
  LOW: { emoji: '🟡', label: 'LOW', color: Colors.low },
  HOT: { emoji: '🔴', label: 'HOT', color: Colors.hot },
};

const SOURCE_COLOR: Record<string, string> = {
  hn: '#ff6600',
  remoteok: '#00b2ff',
  weworkremotely: '#6cc644',
  reddit: Colors.purple,
};

export default function PostCard({ post, onPress }: Props) {
  const traction = getTraction(post);
  const untouched = isUntouched(post);
  const { emoji, label, color } = TRACTION_CONFIG[traction];
  const sourceLabel = post.sourceName ?? `r/${post.subreddit}`;
  const sourceColor = SOURCE_COLOR[post.sourceType ?? 'reddit'] ?? Colors.purple;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, untouched && styles.untouchedCard]}
      activeOpacity={0.75}
    >
      <View style={styles.headerRow}>
        <View style={[styles.pill, { backgroundColor: sourceColor + '2a' }]}>
          <Text style={[styles.pillText, { color: sourceColor }]}>{sourceLabel}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: color + '22' }]}>
          <Text style={[styles.pillText, { color }]}>{emoji} {label}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={3}>{post.title}</Text>

      <View style={styles.footer}>
        <Text style={styles.meta}>⏱ {formatTimeAgo(post.created_utc)}</Text>
        <Text style={styles.meta}>⬆ {post.score}</Text>
        <Text style={styles.meta}>💬 {post.num_comments}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  untouchedCard: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  title: {
    color: Colors.text,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 14,
  },
  meta: {
    color: Colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
});
