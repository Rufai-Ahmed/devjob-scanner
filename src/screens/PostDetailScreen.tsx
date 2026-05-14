import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { FeedStackParamList } from '../types';
import { getTraction, formatTimeAgo } from '../services/redditService';
import { getSettings } from '../services/storageService';
import { generateReply, getGenericReply, AI_PROVIDER_INFO } from '../services/aiService';

type RouteType = RouteProp<FeedStackParamList, 'PostDetail'>;

const TRACTION_CONFIG = {
  UNTOUCHED: { emoji: '🟢', label: 'UNTOUCHED', color: Colors.untouched },
  LOW: { emoji: '🟡', label: 'LOW', color: Colors.low },
  HOT: { emoji: '🔴', label: 'HOT', color: Colors.hot },
};

export default function PostDetailScreen() {
  const { params: { post } } = useRoute<RouteType>();
  const [aiReply, setAiReply] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [generating, setGenerating] = useState(false);

  const traction = getTraction(post);
  const { emoji, label, color } = TRACTION_CONFIG[traction];
  const displaySource = post.sourceName ?? `r/${post.subreddit}`;

  async function handleGenerate() {
    const settings = await getSettings();
    const hasKey =
      (settings.aiProvider === 'anthropic' && settings.anthropicApiKey) ||
      (settings.aiProvider === 'groq' && settings.groqApiKey) ||
      (settings.aiProvider === 'gemini' && settings.geminiApiKey);

    if (!hasKey) {
      // Instant template — no loading needed
      setAiReply(getGenericReply(post));
      setIsTemplate(true);
      return;
    }

    setGenerating(true);
    try {
      const reply = await generateReply(post, settings);
      setAiReply(reply);
      setIsTemplate(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      Alert.alert('AI Error', `${msg}\n\nFalling back to template.`);
      setAiReply(getGenericReply(post));
      setIsTemplate(true);
    } finally {
      setGenerating(false);
    }
  }

  async function copyReply() {
    if (!aiReply) return;
    await Clipboard.setStringAsync(aiReply);
    Alert.alert('Copied!', 'Reply copied to clipboard.');
  }

  async function openOnReddit() {
    const can = await Linking.canOpenURL(post.url);
    if (can) await Linking.openURL(post.url);
  }

  async function getButtonLabel(): Promise<string> {
    const settings = await getSettings();
    const info = AI_PROVIDER_INFO[settings.aiProvider];
    const hasKey =
      (settings.aiProvider === 'anthropic' && settings.anthropicApiKey) ||
      (settings.aiProvider === 'groq' && settings.groqApiKey) ||
      (settings.aiProvider === 'gemini' && settings.geminiApiKey);
    return hasKey ? `Generate with ${info.label}` : 'Use Template Reply';
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: Colors.purple + '2a' }]}>
          <Text style={[styles.badgeText, { color: Colors.purple }]}>{displaySource}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.badgeText, { color }]}>{emoji} {label}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{post.title}</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={styles.stat}>⏱ {formatTimeAgo(post.created_utc)}</Text>
        <Text style={styles.stat}>⬆ {post.score}</Text>
        <Text style={styles.stat}>💬 {post.num_comments}</Text>
        <Text style={styles.stat}>👤 {post.author}</Text>
      </View>

      {/* Body */}
      <View style={styles.bodyBox}>
        {post.selftext ? (
          <Text style={styles.bodyText}>{post.selftext}</Text>
        ) : (
          <Text style={styles.bodyEmpty}>No body text — title only.</Text>
        )}
      </View>

      {/* Open Link */}
      <TouchableOpacity style={styles.linkButton} onPress={openOnReddit} activeOpacity={0.75}>
        <Text style={styles.linkButtonText}>↗ Open Original Post</Text>
      </TouchableOpacity>

      {/* AI Section */}
      <View style={styles.aiSection}>
        <Text style={styles.aiTitle}>✦ AI Reply Generator</Text>

        <TouchableOpacity
          style={[styles.generateButton, generating && { opacity: 0.55 }]}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.generateButtonText}>
              {aiReply ? 'Re-generate Reply' : 'Generate Reply'}
            </Text>
          )}
        </TouchableOpacity>

        {aiReply ? (
          <View style={styles.replyBox}>
            {isTemplate && (
              <View style={styles.templateBadge}>
                <Text style={styles.templateBadgeText}>
                  Template · Add an AI key in Settings for personalised replies
                </Text>
              </View>
            )}
            <Text style={styles.replyText}>{aiReply}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyReply} activeOpacity={0.75}>
              <Text style={styles.copyButtonText}>⎘ Copy to Clipboard</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 48 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  title: {
    color: Colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stat: { color: Colors.textMuted, fontFamily: 'SpaceMono_400Regular', fontSize: 11 },
  bodyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bodyText: {
    color: Colors.text,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    lineHeight: 21,
  },
  bodyEmpty: {
    color: Colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
  },
  linkButton: {
    borderWidth: 1,
    borderColor: Colors.purple,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 28,
    backgroundColor: Colors.purple + '11',
  },
  linkButtonText: { color: Colors.purple, fontFamily: 'SpaceMono_700Bold', fontSize: 13 },
  aiSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 22 },
  aiTitle: {
    color: Colors.accent,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 14,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  generateButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  generateButtonText: { color: Colors.background, fontFamily: 'SpaceMono_700Bold', fontSize: 14 },
  replyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  templateBadge: {
    backgroundColor: Colors.low + '22',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  templateBadgeText: {
    color: Colors.low,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  replyText: {
    color: Colors.text,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 14,
  },
  copyButton: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  copyButtonText: { color: Colors.accent, fontFamily: 'SpaceMono_700Bold', fontSize: 12 },
});
