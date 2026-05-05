import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { Colors, Fonts } from '../theme';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ring1, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(ring2, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => navigation.replace('Auth'), 2600);
    return () => clearTimeout(timer);
  }, []);

  const ringStyle = (anim) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] }),
    transform: [{
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }),
    }],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, ringStyle(ring1)]} />
      <Animated.View style={[styles.ring, ringStyle(ring2)]} />
      <Animated.View style={[styles.logoWrap, { opacity: fade, transform: [{ scale }] }]}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <Text style={styles.appName}>REBEL AI</Text>
        <Text style={styles.tagline}>Your Advanced Intelligence</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  logoWrap: { alignItems: 'center', gap: 14 },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 16,
  },
  logoText: { color: Colors.white, fontSize: 48, fontWeight: '900' },
  appName: { color: Colors.white, fontSize: Fonts.size.xxl, fontWeight: '800', letterSpacing: 6 },
  tagline: { color: Colors.textSecondary, fontSize: Fonts.size.sm, letterSpacing: 2 },
});
