import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors } from '../theme';

export default function SplashScreen({ navigation }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => navigation.replace('Auth'), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
        <Text style={styles.name}>Rebel AI</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 16 },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 24, elevation: 16 },
  logoText: { color: '#fff', fontSize: 36, fontWeight: '900' },
  name: { color: Colors.text, fontSize: 26, fontWeight: '700', letterSpacing: 0.5 },
});
