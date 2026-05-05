import React, { useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  ScrollView, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Fonts, Radius } from '../theme';
import { registerOrLogin } from '../utils/storage';

const { width } = Dimensions.get('window');

export default function AuthScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shake = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;

  useRef(() => {
    Animated.parallel([
      Animated.timing(cardFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  });

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(cardFade, { toValue: 1, duration: 700, delay: 200, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  function doShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  async function handleContinue() {
    const n = name.trim(), e = email.trim().toLowerCase();
    if (!n) { setError('Please enter your name.'); doShake(); return; }
    if (!e || !/\S+@\S+\.\S+/.test(e)) { setError('Enter a valid email.'); doShake(); return; }
    setError(''); setLoading(true);
    try {
      await registerOrLogin(n, e);
      navigation.replace('Main');
    } catch {
      setError('Something went wrong. Try again.');
      doShake();
    } finally { setLoading(false); }
  }

  return (
    <View style={styles.root}>
      {/* Background glow */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoCircle}>
              <Text style={styles.logoLetter}>R</Text>
            </LinearGradient>
            <View>
              <Text style={styles.appName}>Rebel <Text style={{ color: Colors.teal }}>AI</Text></Text>
              <Text style={styles.tagline}>Unleash the Code.</Text>
            </View>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardSlide }, { translateX: shake }] }]}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSub}>Sign in to access Rebel AI</Text>

            <Text style={styles.label}>Your Name</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ujjwal"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* Gradient button */}
            <TouchableOpacity
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.85}
              style={{ marginTop: 24 }}
            >
              <LinearGradient
                colors={['#8a2be2', '#00ced1']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.btn}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Access Rebel AI →</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>or</Text>
              <View style={styles.divLine} />
            </View>

            <TouchableOpacity style={styles.guestBtn} onPress={() => navigation.replace('Main')} activeOpacity={0.7}>
              <Text style={styles.guestText}>Continue as Guest</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.guaranteeRow}>
            <Text style={styles.guaranteeIcon}>🛡️</Text>
            <Text style={styles.guaranteeText}>100% Free · No subscription required</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  bgGlow1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(138,43,226,0.08)', top: -80, left: -80,
  },
  bgGlow2: {
    position: 'absolute', width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(0,206,209,0.06)', bottom: 100, right: -60,
  },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 },
  logoCircle: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 10,
  },
  logoLetter: { color: '#fff', fontSize: 26, fontWeight: '900' },
  appName: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: Colors.textSecondary, fontSize: Fonts.size.xs, marginTop: 2, letterSpacing: 1 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.3)',
    shadowColor: '#8a2be2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800', marginBottom: 4 },
  cardSub: { color: Colors.textSecondary, fontSize: Fonts.size.sm, marginBottom: 24 },
  label: { color: Colors.textSecondary, fontSize: Fonts.size.xs, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, color: Colors.text, fontSize: Fonts.size.md, paddingVertical: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10,
    padding: 10, marginTop: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: '#ef4444', fontSize: Fonts.size.sm },
  btn: {
    borderRadius: 50, paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 15, elevation: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: Fonts.size.md, letterSpacing: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  divText: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  guestBtn: {
    borderWidth: 1, borderColor: 'rgba(0,206,209,0.4)',
    borderRadius: 50, paddingVertical: 13, alignItems: 'center',
  },
  guestText: { color: Colors.teal, fontWeight: '600', fontSize: Fonts.size.sm },
  guaranteeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 20,
  },
  guaranteeIcon: { fontSize: 13 },
  guaranteeText: { color: Colors.textMuted, fontSize: Fonts.size.xs },
});
