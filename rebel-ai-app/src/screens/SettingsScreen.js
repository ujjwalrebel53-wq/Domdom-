import React, { useState, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, Alert, StatusBar, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { DrawerContext } from '../navigation';
import { Colors, Fonts, Radius } from '../theme';
import { getCurrentUser, getSettings, saveSettings, logoutUser } from '../utils/storage';
import { getStats } from '../utils/stats';

function MiniBar({ value, max, color }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <LinearGradient
        colors={[Colors.purple, Colors.teal]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: `${pct}%`, height: '100%', borderRadius: 3 }}
      />
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const drawer = React.useContext(DrawerContext);
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
    setSettings(updated);
    await saveSettings(updated);
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await logoutUser();
          navigation.replace('Auth');
        },
      },
    ]);
  }

  function Section({ title, children }) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCard}>{children}</View>
      </View>
    );
  }

  function Row({ label, value, children, noBorder, icon }) {
    return (
      <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
        <View style={styles.rowLeft}>
          {icon && <Text style={styles.rowIcon}>{icon}</Text>}
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        {children || (value !== undefined && <Text style={styles.rowValue}>{value}</Text>)}
      </View>
    );
  }

  const maxDay = stats ? Math.max(...(stats.last7?.map(d => d.count) || [1]), 1) : 1;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => drawer.open()} style={styles.hamBtn} activeOpacity={0.7} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
            <View style={styles.hamLine} /><View style={[styles.hamLine,{width:18}]} /><View style={styles.hamLine} />
          </TouchableOpacity>
          <Text style={[styles.title, { marginLeft: 12 }]}>Settings</Text>
        </View>
        <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerLine} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* User card */}
        {user && (
          <View style={styles.userCard}>
            <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{user.name?.[0]?.toUpperCase() || 'U'}</Text>
            </LinearGradient>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
                <Text style={styles.badgeText}>✦ Rebel AI Member</Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Usage stats */}
        {stats && (
          <Section title="📊  USAGE STATS">
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <LinearGradient colors={['rgba(138,43,226,0.15)', 'rgba(0,206,209,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGrad}>
                  <Text style={styles.statNum}>{stats.totalMessages}</Text>
                  <Text style={styles.statLabel}>Total Messages</Text>
                </LinearGradient>
              </View>
              <View style={styles.statBox}>
                <LinearGradient colors={['rgba(138,43,226,0.15)', 'rgba(0,206,209,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGrad}>
                  <Text style={styles.statNum}>{stats.todayCount}</Text>
                  <Text style={styles.statLabel}>Today</Text>
                </LinearGradient>
              </View>
              <View style={styles.statBox}>
                <LinearGradient colors={['rgba(138,43,226,0.15)', 'rgba(0,206,209,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGrad}>
                  <Text style={styles.statNum}>{stats.totalSessions}</Text>
                  <Text style={styles.statLabel}>Sessions</Text>
                </LinearGradient>
              </View>
              {stats.firstUsed && (
                <View style={styles.statBox}>
                  <LinearGradient colors={['rgba(138,43,226,0.15)', 'rgba(0,206,209,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGrad}>
                    <Text style={[styles.statNum, { fontSize: Fonts.size.sm }]}>{stats.firstUsed}</Text>
                    <Text style={styles.statLabel}>First Used</Text>
                  </LinearGradient>
                </View>
              )}
            </View>

            {/* 7-day chart */}
            {stats.last7 && (
              <View style={styles.chartWrap}>
                <Text style={styles.chartTitle}>Last 7 Days</Text>
                <View style={styles.chartBars}>
                  {stats.last7.map((d, i) => {
                    const h = Math.max((d.count / maxDay) * 56, d.count > 0 ? 8 : 3);
                    return (
                      <View key={i} style={styles.chartBarWrap}>
                        <Text style={styles.chartCount}>{d.count > 0 ? d.count : ''}</Text>
                        {d.count > 0 ? (
                          <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.chartBar, { height: h }]} />
                        ) : (
                          <View style={[styles.chartBarEmpty, { height: 3 }]} />
                        )}
                        <Text style={styles.chartLabel}>{d.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </Section>
        )}

        {/* Preferences */}
        <Section title="⚙️  PREFERENCES">
          <Row label="Haptic Feedback" icon="📳">
            <Switch
              value={settings.haptics !== false}
              onValueChange={v => update('haptics', v)}
              trackColor={{ false: Colors.bgInput, true: Colors.purple }}
              thumbColor={Colors.white}
            />
          </Row>
          <Row label="Sound Effects" icon="🔔" noBorder>
            <Switch
              value={settings.sound !== false}
              onValueChange={v => update('sound', v)}
              trackColor={{ false: Colors.bgInput, true: Colors.purple }}
              thumbColor={Colors.white}
            />
          </Row>
        </Section>

        {/* App info */}
        <Section title="ℹ️  ABOUT">
          <Row label="Version" icon="🚀" value="1.0.0" />
          <Row label="Built by" icon="👨‍💻" value="Rebel Bhaiya" noBorder />
        </Section>

        {/* Links */}
        <Section title="🌐  CONNECT">
          <Row label="Visit Website" icon="🌍" noBorder>
            <TouchableOpacity onPress={() => Linking.openURL('https://ujjwalrebel53-wq.github.io/Domdom-/')} activeOpacity={0.7}>
              <Text style={styles.linkText}>Open →</Text>
            </TouchableOpacity>
          </Row>
        </Section>

        {user && (
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.82} style={{ marginTop: 4 }}>
            <View style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Rebel AI — Unleash the Code.</Text>
          <Text style={styles.footerSub}>100% Free · No subscriptions</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  headerWrap: { backgroundColor: Colors.bgCard },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 },
  hamBtn: { padding: 4, gap: 5, justifyContent: 'center' },
  hamLine: { width: 22, height: 2.5, backgroundColor: Colors.text, borderRadius: 2 },
  headerLine: { height: 2 },
  title: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 50, gap: 20 },

  userCard: {
    flexDirection: 'row', gap: 16, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.3)',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  userAvatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  userInfo: { flex: 1, gap: 3 },
  userName: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '700' },
  userEmail: { color: Colors.textSecondary, fontSize: Fonts.size.sm },
  badge: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12, alignSelf: 'flex-start', marginTop: 5 },
  badgeText: { color: '#fff', fontSize: Fonts.size.xs, fontWeight: '700' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, paddingBottom: 0 },
  statBox: { flex: 1, minWidth: '44%', borderRadius: 14, overflow: 'hidden' },
  statGrad: { padding: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)' },
  statNum: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '900' },
  statLabel: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginTop: 3 },

  chartWrap: { padding: 14, paddingTop: 10 },
  chartTitle: { color: Colors.textSecondary, fontSize: Fonts.size.xs, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  chartBarWrap: { flex: 1, alignItems: 'center', gap: 4 },
  chartCount: { color: Colors.textMuted, fontSize: 9 },
  chartBar: { width: '100%', borderRadius: 4 },
  chartBarEmpty: { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  chartLabel: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },

  section: { gap: 8 },
  sectionTitle: { color: Colors.textMuted, fontSize: Fonts.size.xs, fontWeight: '700', letterSpacing: 2, paddingHorizontal: 4 },
  sectionCard: { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 16 },
  rowLabel: { color: Colors.text, fontSize: Fonts.size.md },
  rowValue: { color: Colors.textSecondary, fontSize: Fonts.size.sm },
  linkText: { color: Colors.teal, fontSize: Fonts.size.sm, fontWeight: '600' },

  logoutBtn: {
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: Fonts.size.md },
  footer: { alignItems: 'center', gap: 4, paddingTop: 10 },
  footerText: { color: Colors.textMuted, fontSize: Fonts.size.xs, letterSpacing: 1 },
  footerSub: { color: Colors.textMuted, fontSize: Fonts.size.xs },
});
