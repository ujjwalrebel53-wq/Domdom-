import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '../theme';

export default function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: -7, duration: 280, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(480 - i * 160),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.row}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.teal },
});
