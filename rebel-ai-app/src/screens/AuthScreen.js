import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Colors, Fonts, Radius } from '../theme';
import { registerOrLogin } from '../utils/storage';

export default function AuthScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  function doShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleContinue() {
    const n = name.trim(), e = email.trim().toLowerCase();
    if (!n || !e) { setError('Please enter your name and email.'); doShake(); return; }
    if (!/\S+@\S+\.\S+/.test(e)) { setError('Enter a valid email address.'); doShake(); return; }
    setError(''); setLoading(true);
    try {
      await registerOrLogin(n, e);
      navigation.replace('Main');
    } catch {
      setError('Something went wrong. Try again.');
      doShake();
    } finally { setLoading(false); }
  }

  function skipAsGuest() {
    navigation.replace('Main');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoCircle}><Text style={styles.logoLetter}>R</Text></View>
          <View>
            <Text style={styles.appName}>REBEL AI</Text>
            <Text style={styles.tagline}>Sign in to remember your chats</Text>
          </View>
        </View>

        <Animated.View style={[styles.card, { transform: [{ translateX: shake }] }]}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ujjwal"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Text style={[styles.label, { marginTop: 16 }]}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={loading} activeOpacity={0.82}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Continue →</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.guestBtn} onPress={skipAsGuest} activeOpacity={0.7}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 },
  logoCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 10,
  },
  logoLetter: { color: Colors.white, fontSize: 28, fontWeight: '900' },
  appName: { color: Colors.white, fontSize: Fonts.size.xl, fontWeight: '800', letterSpacing: 3 },
  tagline: { color: Colors.textSecondary, fontSize: Fonts.size.sm, marginTop: 2 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: { color: Colors.textSecondary, fontSize: Fonts.size.sm, marginBottom: 8, letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    padding: 14,
    color: Colors.text,
    fontSize: Fonts.size.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  error: { color: Colors.error, fontSize: Fonts.size.sm, marginTop: 12 },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.size.md, letterSpacing: 0.5 },
  guestBtn: { alignItems: 'center', marginTop: 16, padding: 8 },
  guestText: { color: Colors.textMuted, fontSize: Fonts.size.sm },
});
