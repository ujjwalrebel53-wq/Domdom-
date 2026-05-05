import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Fonts, Radius, Shadow } from '../theme';

export default function GradientButton({ label, onPress, style, textStyle, disabled, icon }) {
  const scale = useRef(new Animated.Value(1)).current;
  const shadow = useRef(new Animated.Value(0.6)).current;

  function pressIn() {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.94, duration: 100, useNativeDriver: true }),
      Animated.timing(shadow, { toValue: 1.0, duration: 100, useNativeDriver: false }),
    ]).start();
  }

  function pressOut() {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(shadow, { toValue: 0.6, duration: 200, useNativeDriver: false }),
    ]).start();
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <LinearGradient
          colors={disabled ? ['#444', '#555'] : ['#8a2be2', '#00ced1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btn}
        >
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.label, textStyle]}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: Radius.full,
    gap: 8,
  },
  label: {
    color: Colors.white,
    fontSize: Fonts.size.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  icon: { fontSize: 16 },
});
