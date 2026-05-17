import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LeadStatus, RedditPost } from '../types';
import { Colors } from '../constants/colors';
import { getTraction, formatTimeAgo, isUntouched } from '../services/redditService';

interface Props {
  post: RedditPost;
  status?: LeadStatus;
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
  'reddit-search': '#ff4500',
  'reddit-discovery': '#7c3aed',
  reddit: Colors.purple,
};

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  interested: { label: 'INTERESTED', color: Colors.low },
  replied: { label: 'REPLIED', color: Colors.accent },
  closed: { label: 'CLOSED', color: Colors.textMuted },
};

export default function PostCard({ post, status, onPress }: Props) {
  const traction = getTraction(post);
  const untouched = isUntouched(post);
  const { emoji, label, color } = TRACTION_CONFIG[traction];
  const sourceLabel = post.sourceName ?? `r/${post.subreddit}`;
  const sourceColor = SOURCE_COLOR[post.sourceType ?? 'reddit'] ?? Colors.purple;
  const score = post.leadScore !== undefined ? Math.round(post.leadScore) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, untouched && styles.untouchedCard]}
      activeOpacity={0.75}
    >
      <View style={styles.headerRow}>
        <View style={[styles.pill, { backgroundColor: sourceColor + '2a', flexShrink: 1 }]}>
          <Text style={[styles.pillText, { color: sourceColor }]} numberOfLines={1}>{sourceLabel}</Text>
        </View>
        <View style={styles.rightPills}>
          {status && (
            <View style={[styles.pill, { backgroundColor: STATUS_CONFIG[status].color + '22' }]}>
              <Text style={[styles.pillText, { color: STATUS_CONFIG[status].color }]}>
                {STATUS_CONFIG[status].label}
              </Text>
            </View>
          )}
          <View style={[styles.pill, { backgroundColor: color + '22' }]}>
            <Text style={[styles.pillText, { color }]}>{emoji} {label}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={3}>{post.title}</Text>

      <View style={styles.footer}>
        <Text style={styles.meta}>⏱ {formatTimeAgo(post.created_utc)}</Text>
        <Text style={styles.meta}>⬆ {post.score}</Text>
        <Text style={styles.meta}>💬 {post.num_comments}</Text>
        {score !== null && (
          <Text style={[styles.meta, styles.scoreText]}>★ {score}</Text>
        )}
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
  rightPills: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
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
    alignItems: 'center',
  },
  meta: {
    color: Colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  scoreText: {
    color: Colors.accent,
    fontFamily: 'SpaceMono_700Bold',
    marginLeft: 'auto',
  },
});
