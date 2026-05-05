// ChatGPT-style settings
import React, { useState, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, Alert, StatusBar, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Fonts, Radius } from '../theme';
import { getCurrentUser, getSettings, saveSettings, logoutUser } from '../utils/storage';
import { getStats } from '../utils/stats';
import { deleteAllConversations } from '../utils/conversations';

export default function SettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ haptics: true, sound: true });
  const [stats, setStats] = useState(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [cu, s, st] = await Promise.all([getCurrentUser(), getSettings(), getStats()]);
      setUser(cu); setSettings(s); setStats(st);
    })();
  }, []));

  async function update(key, val) {
    const updated = { ...settings, [key]: val };
    setSettings(updated); await saveSettings(updated);
  }

  function Section({ title, children }) {
    return (
      <View style={styles.section}>
        {title && <Text style={styles.sectionTitle}>{title}</Text>}
        <View style={styles.sectionCard}>{children}</View>
      </View>
    );
  }

  function Row({ label, icon, value, children, noBorder, onPress, destructive }) {
    const content = (
      <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
        {icon && <Text style={styles.rowIcon}>{icon}</Text>}
        <Text style={[styles.rowLabel, destructive && { color: Colors.error }]}>{label}</Text>
        <View style={{ flex: 1 }} />
        {children || (value !== undefined && <Text style={styles.rowValue}>{value}</Text>)}
        {onPress && !children && <Text style={styles.rowChevron}>›</Text>}
      </View>
    );
    return onPress
      ? <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>
      : content;
  }

  const maxDay = stats ? Math.max(...(stats.last7?.map(d => d.count) || [1]), 1) : 1;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User card */}
        {user && (
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{user.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        )}

        {/* Stats */}
        {stats && (
          <Section title="Usage">
            <View style={styles.statsRow}>
              {[
                { label: 'Messages', value: stats.totalMessages },
                { label: 'Today', value: stats.todayCount },
                { label: 'Sessions', value: stats.totalSessions },
              ].map((s, i) => (
                <View key={i} style={[styles.statBox, i > 0 && { borderLeftWidth: 1, borderLeftColor: Colors.borderSubtle }]}>
                  <Text style={styles.statNum}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            {stats.last7 && (
              <View style={styles.chart}>
                <Text style={styles.chartTitle}>Last 7 Days</Text>
                <View style={styles.chartBars}>
                  {stats.last7.map((d, i) => {
                    const h = Math.max((d.count / maxDay) * 52, d.count > 0 ? 6 : 2);
                    return (
                      <View key={i} style={styles.barWrap}>
                        <Text style={styles.barCount}>{d.count > 0 ? d.count : ''}</Text>
                        <View style={[styles.bar, { height: h, backgroundColor: d.count > 0 ? Colors.accent : Colors.bgHover }]} />
                        <Text style={styles.barLabel}>{d.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </Section>
        )}

        {/* Preferences */}
        <Section title="Preferences">
          <Row label="Haptic feedback" icon="📳">
            <Switch value={settings.haptics !== false} onValueChange={v => update('haptics', v)} trackColor={{ false: Colors.bgHover, true: Colors.accent }} thumbColor="#fff" />
          </Row>
          <Row label="Sound effects" icon="🔔" noBorder>
            <Switch value={settings.sound !== false} onValueChange={v => update('sound', v)} trackColor={{ false: Colors.bgHover, true: Colors.accent }} thumbColor="#fff" />
          </Row>
        </Section>

        {/* Data */}
        <Section title="Data controls">
          <Row label="Delete all conversations" icon="🗑" destructive noBorder onPress={() => {
            Alert.alert('Delete All', 'This will permanently delete all your conversations.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete all', style: 'destructive', onPress: async () => { await deleteAllConversations(); } },
            ]);
          }} />
        </Section>

        {/* About */}
        <Section title="About">
          <Row label="Version" icon="🚀" value="1.0.0" />
          <Row label="Built by" icon="👨‍💻" value="Rebel Bhaiya" />
          <Row label="Website" icon="🌐" noBorder onPress={() => Linking.openURL('https://ujjwalrebel53-wq.github.io/Domdom-/')}>
            <Text style={styles.linkText}>Open ›</Text>
          </Row>
        </Section>

        {/* Sign out */}
        {user && (
          <Section>
            <Row label="Sign out" icon="🚪" noBorder destructive onPress={() => {
              Alert.alert('Sign Out', '', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: async () => { await logoutUser(); navigation.replace('Auth'); } },
              ]);
            }} />
          </Section>
        )}

        <Text style={styles.footer}>Rebel AI — Unleash the Code.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: Colors.borderSubtle },
  backIcon: { color: Colors.text, fontSize: 28, fontWeight: '300' },
  title: { color: Colors.text, fontSize: Fonts.size.lg, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50, gap: 24 },

  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border },
  userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  userInfo: { flex: 1 },
  userName: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '600' },
  userEmail: { color: Colors.textSecondary, fontSize: Fonts.size.sm, marginTop: 2 },

  statsRow: { flexDirection: 'row' },
  statBox: { flex: 1, alignItems: 'center', padding: 16 },
  statNum: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginTop: 3 },

  chart: { padding: 16, paddingTop: 4 },
  chartTitle: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginBottom: 10 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  barCount: { color: Colors.textMuted, fontSize: 9 },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: { color: Colors.textMuted, fontSize: 9 },

  section: { gap: 6 },
  sectionTitle: { color: Colors.textMuted, fontSize: Fonts.size.xs, fontWeight: '600', paddingHorizontal: 4, letterSpacing: 0.3 },
  sectionCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: Colors.borderSubtle, gap: 12 },
  rowIcon: { fontSize: 17, width: 24 },
  rowLabel: { color: Colors.text, fontSize: Fonts.size.md },
  rowValue: { color: Colors.textSecondary, fontSize: Fonts.size.sm },
  rowChevron: { color: Colors.textMuted, fontSize: 20 },
  linkText: { color: Colors.accent, fontSize: Fonts.size.sm },

  footer: { color: Colors.textMuted, fontSize: Fonts.size.xs, textAlign: 'center', marginTop: 8 },
});
