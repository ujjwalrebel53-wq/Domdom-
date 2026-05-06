import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Fonts } from '../theme';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(0.8)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(0.8)).current;
  const textSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 55, useNativeDriver: true }),
      Animated.timing(textSlide, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    // Pulse rings — mimics website's .pulse-ring animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1Scale, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring1Scale, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.parallel([
          Animated.timing(ring2Scale, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring2Scale, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    const t = setTimeout(() => navigation.replace('Auth'), 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      {/* Background radial glow matching website */}
      <View style={styles.bgGlow} />

      <Animated.View style={[styles.center, { opacity: fade }]}>
        {/* Avatar with pulse rings */}
        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.ring, styles.ring1, {
            opacity: ring1Opacity,
            transform: [{ scale: ring1Scale }],
            borderColor: Colors.purple,
          }]} />
          <Animated.View style={[styles.ring, styles.ring2, {
            opacity: ring2Opacity,
            transform: [{ scale: ring2Scale }],
            borderColor: Colors.teal,
          }]} />
          <Animated.View style={[styles.avatarCircle, { transform: [{ scale }] }]}>
            <LinearGradient
              colors={['#8a2be2', '#00ced1']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.avatarGrad}
            >
              <Text style={styles.avatarLetter}>R</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Text */}
        <Animated.View style={{ transform: [{ translateY: textSlide }], opacity: fade, alignItems: 'center', marginTop: 28 }}>
          <Text style={styles.appName}>
            <Text style={styles.nameWhite}>Rebel </Text>
            <Text style={styles.nameTeal}>AI</Text>
          </Text>
          <Text style={styles.tagline}>Unleash the Code.</Text>
        </Animated.View>
      </Animated.View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.barLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  bgGlow: {
    position: 'absolute', width: 400, height: 400, borderRadius: 200,
    backgroundColor: 'rgba(138,43,226,0.07)', top: '20%', left: '50%',
    transform: [{ translateX: -200 }],
  },
  center: { alignItems: 'center' },
  avatarWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 2 },
  ring1: { width: 160, height: 160 },
  ring2: { width: 180, height: 180 },
  avatarCircle: {
    width: 110, height: 110, borderRadius: 55, overflow: 'hidden',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 24, elevation: 16,
  },
  avatarGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 52, fontWeight: '900' },
  appName: { fontSize: Fonts.size.hero, fontWeight: '800', letterSpacing: 2 },
  nameWhite: { color: Colors.text },
  nameTeal: { color: Colors.teal },
  tagline: { color: Colors.textSecondary, fontSize: Fonts.size.sm, letterSpacing: 3, marginTop: 6 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  barLine: { height: 3 },
});
