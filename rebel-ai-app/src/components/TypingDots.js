import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '../theme';

export default function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(540 - i * 180),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <View style={styles.botAvatar}></View>
        <View style={styles.dots}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: d }] }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignSelf: 'flex-start', marginVertical: 5, alignItems: 'flex-end', gap: 8, paddingHorizontal: 0 },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accent, marginBottom: 2,
  },
  bubble: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: Colors.bgBubbleBot, borderRadius: 18,
    borderBottomLeftRadius: 4, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accentLight },
});
