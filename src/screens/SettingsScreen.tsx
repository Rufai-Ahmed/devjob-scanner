import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { Colors } from '../constants/colors';
import { AppSettings, AIProvider } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { SUBREDDITS, STACK_FILTERS, OTHER_SOURCES } from '../constants/subreddits';
import { getPermissionStatus, requestNotificationPermissions } from '../services/notificationService';
import { registerBackgroundTask } from '../services/backgroundTask';
import { AI_PROVIDER_INFO } from '../services/aiService';

const AI_PROVIDERS: AIProvider[] = ['anthropic', 'groq', 'gemini'];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    enabledSubreddits: ['forhire', 'WebDevJobs', 'Programmers_forhire'],
    enabledSources: ['hn', 'remoteok', 'weworkremotely'],
    stackFilters: [],
    fetchInterval: 15,
    notificationsEnabled: true,
    aiProvider: 'anthropic',
    anthropicApiKey: '',
    groqApiKey: '',
    geminiApiKey: '',
    searchEnabled: true,
    searchTerms: [],
  });
  const [permStatus, setPermStatus] = useState('checking...');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [pendingKey, setPendingKey] = useState('');
  const [newTerm, setNewTerm] = useState('');

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setPendingKey(activeKey(s));
    });
    getPermissionStatus().then(setPermStatus);
  }, []);

  function activeKey(s: AppSettings): string {
    if (s.aiProvider === 'groq') return s.groqApiKey;
    if (s.aiProvider === 'gemini') return s.geminiApiKey;
    return s.anthropicApiKey;
  }

  const persist = useCallback(async (updated: AppSettings) => {
    setSettings(updated);
    await saveSettings(updated);
    await registerBackgroundTask(updated.fetchInterval);
  }, []);

  function toggleSubreddit(name: string) {
    const next = settings.enabledSubreddits.includes(name)
      ? settings.enabledSubreddits.filter(s => s !== name)
      : [...settings.enabledSubreddits, name];
    persist({ ...settings, enabledSubreddits: next });
  }

  function toggleSource(name: string) {
    const next = settings.enabledSources.includes(name)
      ? settings.enabledSources.filter(s => s !== name)
      : [...settings.enabledSources, name];
    persist({ ...settings, enabledSources: next });
  }

  function toggleFilter(filter: string) {
    const next = settings.stackFilters.includes(filter)
      ? settings.stackFilters.filter(f => f !== filter)
      : [...settings.stackFilters, filter];
    persist({ ...settings, stackFilters: next });
  }

  function selectProvider(provider: AIProvider) {
    const updated = { ...settings, aiProvider: provider };
    setPendingKey(activeKey(updated));
    persist(updated);
  }

  function saveActiveKey() {
    const key = pendingKey.trim();
    const updated = {
      ...settings,
      anthropicApiKey: settings.aiProvider === 'anthropic' ? key : settings.anthropicApiKey,
      groqApiKey: settings.aiProvider === 'groq' ? key : settings.groqApiKey,
      geminiApiKey: settings.aiProvider === 'gemini' ? key : settings.geminiApiKey,
    };
    persist(updated);
  }

  async function requestPerm() {
    const granted = await requestNotificationPermissions();
    setPermStatus(granted ? 'granted' : 'denied');
  }

  const permGranted = permStatus === 'granted';
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const info = AI_PROVIDER_INFO[settings.aiProvider];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: statusBarHeight + 16 }]}
    >
      <Text style={styles.screenTitle}>Settings</Text>

      {/* ── Notifications ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <SettingRow label="Enable Notifications">
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={v => persist({ ...settings, notificationsEnabled: v })}
            trackColor={{ false: Colors.border, true: Colors.accent + '55' }}
            thumbColor={settings.notificationsEnabled ? Colors.accent : Colors.textMuted}
          />
        </SettingRow>
        <SettingRow label="Permission Status" last>
          <View style={[styles.statusBadge, { backgroundColor: permGranted ? Colors.accent + '22' : Colors.hot + '22' }]}>
            <Text style={[styles.statusText, { color: permGranted ? Colors.accent : Colors.hot }]}>
              {permStatus.toUpperCase()}
            </Text>
          </View>
        </SettingRow>
        {!permGranted && (
          <TouchableOpacity style={styles.outlineButton} onPress={requestPerm}>
            <Text style={styles.outlineButtonText}>Request Permission</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Battery Optimization (Android only) ── */}
      {Platform.OS === 'android' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Background Scanning</Text>
          <Text style={styles.sectionHint}>
            Android battery optimization can delay or skip scans. Disable it for this app so scans run on time.
          </Text>
          <TouchableOpacity style={styles.outlineButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.outlineButtonText}>Open App Battery Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Lead Search ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Lead Search</Text>
        <Text style={styles.sectionHint}>Scans all of Reddit for people asking for a developer. Fresh posts only (last 24h).</Text>
        <SettingRow label="Enable Lead Search">
          <Switch
            value={settings.searchEnabled}
            onValueChange={v => persist({ ...settings, searchEnabled: v })}
            trackColor={{ false: Colors.border, true: Colors.accent + '55' }}
            thumbColor={settings.searchEnabled ? Colors.accent : Colors.textMuted}
          />
        </SettingRow>
        <View style={[styles.apiKeyRow, { marginTop: 12 }]}>
          <TextInput
            style={styles.apiKeyInput}
            value={newTerm}
            onChangeText={setNewTerm}
            placeholder='e.g. "need a website"'
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              const t = newTerm.trim();
              if (t && !settings.searchTerms.includes(t)) {
                persist({ ...settings, searchTerms: [...settings.searchTerms, t] });
              }
              setNewTerm('');
            }}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => {
              const t = newTerm.trim();
              if (t && !settings.searchTerms.includes(t)) {
                persist({ ...settings, searchTerms: [...settings.searchTerms, t] });
              }
              setNewTerm('');
            }}
          >
            <Text style={[styles.outlineButtonText, { fontSize: 18 }]}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.chipRow, { marginTop: 12 }]}>
          {settings.searchTerms.map(term => (
            <TouchableOpacity
              key={term}
              style={[styles.chip, styles.chipActive]}
              onPress={() => persist({ ...settings, searchTerms: settings.searchTerms.filter(t => t !== term) })}
            >
              <Text style={styles.chipTextActive}>{term} ✕</Text>
            </TouchableOpacity>
          ))}
          {settings.searchTerms.length === 0 && (
            <Text style={[styles.sectionHint, { marginBottom: 0 }]}>No terms yet — add one above.</Text>
          )}
        </View>
      </View>

      {/* ── Reddit Subreddits ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Reddit Subreddits</Text>
        {SUBREDDITS.map((sub, i) => (
          <SettingRow key={sub.name} label={sub.displayName} last={i === SUBREDDITS.length - 1}>
            <Switch
              value={settings.enabledSubreddits.includes(sub.name)}
              onValueChange={() => toggleSubreddit(sub.name)}
              trackColor={{ false: Colors.border, true: Colors.accent + '55' }}
              thumbColor={settings.enabledSubreddits.includes(sub.name) ? Colors.accent : Colors.textMuted}
            />
          </SettingRow>
        ))}
      </View>

      {/* ── Other Platforms ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Other Platforms</Text>
        {OTHER_SOURCES.map((src, i) => (
          <SettingRow key={src.name} label={src.displayName} last={i === OTHER_SOURCES.length - 1}>
            <Switch
              value={settings.enabledSources.includes(src.name)}
              onValueChange={() => toggleSource(src.name)}
              trackColor={{ false: Colors.border, true: src.color + '88' }}
              thumbColor={settings.enabledSources.includes(src.name) ? src.color : Colors.textMuted}
            />
          </SettingRow>
        ))}
      </View>

      {/* ── Stack Filters ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Stack Filters</Text>
        <Text style={styles.sectionHint}>Tag your focus areas</Text>
        <View style={styles.chipRow}>
          {STACK_FILTERS.map(f => {
            const active = settings.stackFilters.includes(f);
            return (
              <TouchableOpacity
                key={f}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleFilter(f)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Scan Interval ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Background Scan Interval</Text>
        <View style={styles.intervalRow}>
          {([15, 30, 60] as const).map(m => {
            const active = settings.fetchInterval === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.intervalBtn, active && styles.intervalBtnActive]}
                onPress={() => persist({ ...settings, fetchInterval: m })}
              >
                <Text style={[styles.intervalText, active && styles.intervalTextActive]}>{m}m</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── AI Provider ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>AI Reply Provider</Text>
        <Text style={styles.sectionHint}>No key? A polished template reply is used as fallback.</Text>

        {/* Provider selector */}
        <View style={styles.providerRow}>
          {AI_PROVIDERS.map(p => {
            const active = settings.aiProvider === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.providerBtn, active && styles.providerBtnActive]}
                onPress={() => selectProvider(p)}
              >
                <Text style={[styles.providerBtnText, active && styles.providerBtnTextActive]}>
                  {p === 'anthropic' ? 'Claude' : p === 'groq' ? 'Groq' : 'Gemini'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Key input for selected provider */}
        <Text style={styles.providerName}>{info.label}</Text>
        <View style={styles.apiKeyRow}>
          <TextInput
            style={styles.apiKeyInput}
            value={pendingKey}
            onChangeText={setPendingKey}
            onBlur={saveActiveKey}
            placeholder={info.placeholder}
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry={!apiKeyVisible}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setApiKeyVisible(v => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{apiKeyVisible ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.outlineButton, { marginTop: 10 }]} onPress={saveActiveKey}>
          <Text style={styles.outlineButtonText}>Save Key</Text>
        </TouchableOpacity>
        <View style={styles.freeNoteRow}>
          <Text style={styles.freeNote}>{info.freeNote} · </Text>
          <Text style={[styles.freeNote, { color: Colors.purple }]}>{info.docsUrl}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>DevJob Scanner v1.0.0</Text>
        <Text style={styles.footerText}>Rufai Ahmed · ahmed.unicon.com.ng</Text>
      </View>
    </ScrollView>
  );
}

function SettingRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.settingRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  screenTitle: { color: Colors.accent, fontFamily: 'SpaceMono_700Bold', fontSize: 22, marginBottom: 22 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionLabel: {
    color: Colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionHint: {
    color: Colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    marginTop: -8,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLabel: { color: Colors.text, fontFamily: 'SpaceMono_400Regular', fontSize: 13, flex: 1, paddingRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.accent + '11',
    marginTop: 12,
  },
  outlineButtonText: { color: Colors.accent, fontFamily: 'SpaceMono_700Bold', fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
  },
  chipActive: { borderColor: Colors.purple, backgroundColor: Colors.purple + '22' },
  chipText: { color: Colors.textMuted, fontFamily: 'SpaceMono_400Regular', fontSize: 12 },
  chipTextActive: { color: Colors.purple, fontFamily: 'SpaceMono_700Bold' },
  intervalRow: { flexDirection: 'row', gap: 10 },
  intervalBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 9,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', backgroundColor: Colors.surfaceElevated,
  },
  intervalBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '1a' },
  intervalText: { color: Colors.textMuted, fontFamily: 'SpaceMono_700Bold', fontSize: 14 },
  intervalTextActive: { color: Colors.accent },
  providerRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  providerBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', backgroundColor: Colors.surfaceElevated,
  },
  providerBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '1a' },
  providerBtnText: { color: Colors.textMuted, fontFamily: 'SpaceMono_700Bold', fontSize: 11 },
  providerBtnTextActive: { color: Colors.accent },
  providerName: {
    color: Colors.textMuted, fontFamily: 'SpaceMono_400Regular',
    fontSize: 11, marginBottom: 8,
  },
  apiKeyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 9, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12,
  },
  apiKeyInput: {
    flex: 1, color: Colors.text, fontFamily: 'SpaceMono_400Regular',
    fontSize: 12, paddingVertical: 12,
  },
  eyeBtn: { padding: 4 },
  eyeText: { fontSize: 16 },
  freeNoteRow: { flexDirection: 'row', marginTop: 8 },
  freeNote: { color: Colors.textMuted, fontFamily: 'SpaceMono_400Regular', fontSize: 11 },
  footer: { alignItems: 'center', gap: 4, paddingTop: 8 },
  footerText: { color: Colors.textSubtle, fontFamily: 'SpaceMono_400Regular', fontSize: 11 },
});
