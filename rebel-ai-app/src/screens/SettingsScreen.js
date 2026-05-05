import React, { useState, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Fonts, Radius } from '../theme';
import { getCurrentUser, getSettings, saveSettings, logoutUser } from '../utils/storage';

export default function SettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ haptics: true, sound: true, systemPrompt: '' });

  useFocusEffect(useCallback(() => {
    (async () => {
      const cu = await getCurrentUser();
      const s = await getSettings();
      setUser(cu); setSettings(s);
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

  function Row({ label, children, noBorder }) {
    return (
      <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
        <Text style={styles.rowLabel}>{label}</Text>
        {children}
      </View>
    );
  }

  function Section({ title, children }) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCard}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {user && (
        <View style={styles.userCard}>
          <View style={styles.userAvatar}><Text style={styles.userAvatarText}>{user.name?.[0]?.toUpperCase()}</Text></View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userJoined}>Joined {user.joined}</Text>
          </View>
        </View>
      )}

      <Section title="PREFERENCES">
        <Row label="Haptic Feedback">
          <Switch
            value={settings.haptics}
            onValueChange={v => update('haptics', v)}
            trackColor={{ false: Colors.bgInput, true: Colors.accent }}
            thumbColor={Colors.white}
          />
        </Row>
        <Row label="Sound Effects" noBorder>
          <Switch
            value={settings.sound}
            onValueChange={v => update('sound', v)}
            trackColor={{ false: Colors.bgInput, true: Colors.accent }}
            thumbColor={Colors.white}
          />
        </Row>
      </Section>

      <Section title="SYSTEM PROMPT">
        <TextInput
          style={styles.promptInput}
          placeholder="Custom AI personality / instructions..."
          placeholderTextColor={Colors.textMuted}
          value={settings.systemPrompt}
          onChangeText={v => update('systemPrompt', v)}
          multiline
          numberOfLines={4}
        />
      </Section>

      <Section title="ABOUT">
        <Row label="Version" noBorder>
          <Text style={styles.valueText}>1.0.0</Text>
        </Row>
        <Row label="Model" noBorder>
          <Text style={styles.valueText}>GPT-5 (Rebel API)</Text>
        </Row>
        <Row label="Built by" noBorder>
          <Text style={styles.valueText}>Rebel Bhaiya</Text>
        </Row>
      </Section>

      {user && (
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 18, paddingBottom: 40, gap: 20 },
  userCard: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: 18, borderWidth: 1, borderColor: Colors.border,
  },
  userAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: Colors.white, fontSize: 24, fontWeight: '900' },
  userInfo: { flex: 1, gap: 2 },
  userName: { color: Colors.white, fontSize: Fonts.size.md, fontWeight: '700' },
  userEmail: { color: Colors.textSecondary, fontSize: Fonts.size.sm },
  userJoined: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  section: { gap: 8 },
  sectionTitle: { color: Colors.textMuted, fontSize: Fonts.size.xs, fontWeight: '700', letterSpacing: 2, paddingHorizontal: 4 },
  sectionCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  rowLabel: { color: Colors.text, fontSize: Fonts.size.md },
  valueText: { color: Colors.textSecondary, fontSize: Fonts.size.sm },
  promptInput: {
    color: Colors.text, fontSize: Fonts.size.sm,
    padding: 16, minHeight: 90, textAlignVertical: 'top',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: Radius.full,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
  },
  logoutTxt: { color: Colors.error, fontWeight: '700', fontSize: Fonts.size.md },
});
