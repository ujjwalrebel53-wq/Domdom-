import React, { useState, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, Alert, StatusBar, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Fonts, Radius } from '../theme';
import { getCurrentUser, getSettings, saveSettings, logoutUser } from '../utils/storage';

export default function SettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ haptics: true, sound: true });

  useFocusEffect(useCallback(() => {
    (async () => {
      const [cu, s] = await Promise.all([getCurrentUser(), getSettings()]);
      setUser(cu); setSettings(s);
    })();
  }, []));

  async function update(key, val) {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    await saveSettings(updated);
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
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
        {children || (value && <Text style={styles.rowValue}>{value}</Text>)}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
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
              <View style={styles.userBadge}>
                <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
                  <Text style={styles.badgeText}>✦ Rebel AI User</Text>
                </LinearGradient>
              </View>
            </View>
          </View>
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

        {/* About Rebel AI */}
        <Section title="ℹ️  ABOUT REBEL AI">
          <Row label="Version" icon="🚀" value="1.0.0" />
          <Row label="Built by" icon="👨‍💻" value="Rebel Bhaiya" />
          <Row label="App" icon="🤖" value="Rebel AI" noBorder />
        </Section>

        {/* Links */}
        <Section title="🌐  CONNECT">
          <Row label="Visit Website" icon="🌍" noBorder>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://ujjwalrebel53-wq.github.io/Domdom-/')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>Open →</Text>
            </TouchableOpacity>
          </Row>
        </Section>

        {/* Logout */}
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
  header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  headerLine: { height: 2 },
  title: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 50, gap: 20 },

  userCard: {
    flexDirection: 'row', gap: 16, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.25)',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  userAvatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  userInfo: { flex: 1, gap: 3 },
  userName: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '700' },
  userEmail: { color: Colors.textSecondary, fontSize: Fonts.size.sm },
  userBadge: { marginTop: 6 },
  badge: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontSize: Fonts.size.xs, fontWeight: '700' },

  section: { gap: 8 },
  sectionTitle: {
    color: Colors.textMuted, fontSize: Fonts.size.xs,
    fontWeight: '700', letterSpacing: 2, paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
  },
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
    borderRadius: Radius.full, paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: Fonts.size.md },

  footer: { alignItems: 'center', gap: 4, paddingTop: 10 },
  footerText: { color: Colors.textMuted, fontSize: Fonts.size.xs, letterSpacing: 1 },
  footerSub: { color: Colors.textMuted, fontSize: Fonts.size.xs },
});
