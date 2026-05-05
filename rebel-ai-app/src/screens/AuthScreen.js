// ChatGPT-style auth screen
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
  const fade = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  function doShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  async function handleContinue() {
    const n = name.trim(), e = email.trim().toLowerCase();
    if (!n) { setError('Please enter your name.'); doShake(); return; }
    if (!e || !/\S+@\S+\.\S+/.test(e)) { setError('Enter a valid email address.'); doShake(); return; }
    setError(''); setLoading(true);
    try {
      await registerOrLogin(n, e);
      navigation.replace('Main');
    } catch {
      setError('Something went wrong. Please try again.'); doShake();
    } finally { setLoading(false); }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.center, { opacity: fade }]}>
            {/* Logo */}
            <View style={styles.logo}>
              <Text style={styles.logoText}>R</Text>
            </View>
            <Text style={styles.title}>Welcome to Rebel AI</Text>
            <Text style={styles.subtitle}>Sign in to save your conversations</Text>

            {/* Form */}
            <Animated.View style={[styles.form, { transform: [{ translateX: shake }] }]}>
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={Colors.textMuted}
                  value={name} onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email} onChangeText={setEmail}
                  keyboardType="email-address" autoCapitalize="none"
                />
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>Continue</Text>}
              </TouchableOpacity>

              <View style={styles.divRow}>
                <View style={styles.divLine} />
                <Text style={styles.divText}>or</Text>
                <View style={styles.divLine} />
              </View>

              <TouchableOpacity style={styles.guestBtn} onPress={() => navigation.replace('Main')} activeOpacity={0.8}>
                <Text style={styles.guestText}>Continue as guest</Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingTop: 60 },
  center: { alignItems: 'center', width: '100%' },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  title: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: Fonts.size.sm, marginBottom: 32, textAlign: 'center' },
  form: { width: '100%', gap: 16 },
  fieldWrap: { gap: 6 },
  label: { color: Colors.textSecondary, fontSize: Fonts.size.sm, fontWeight: '500' },
  input: {
    backgroundColor: Colors.bgInput, borderRadius: Radius.md, padding: 14,
    color: Colors.text, fontSize: Fonts.size.md, borderWidth: 1, borderColor: Colors.border,
  },
  error: { color: Colors.error, fontSize: Fonts.size.sm },
  btn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    padding: 15, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: Fonts.size.md },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  guestBtn: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  guestText: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '500' },
  terms: { color: Colors.textMuted, fontSize: Fonts.size.xs, textAlign: 'center', marginTop: 28, lineHeight: 16 },
});
