import React, { useRef, useEffect } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius } from '../theme';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const slideX = useRef(new Animated.Value(isUser ? 30 : -30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideX, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        isUser ? styles.wrapperUser : styles.wrapperBot,
        { opacity, transform: [{ translateX: slideX }] },
      ]}
    >
      {!isUser && (
        <View style={styles.botAvatar}>
          <Text style={styles.botAvatarText}>R</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot, message.isError && styles.bubbleError]}>
        {message.image && (
          <Image source={{ uri: message.image }} style={styles.image} resizeMode="cover" />
        )}
        <Text style={[styles.text, isUser ? styles.textUser : styles.textBot]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isUser ? styles.timeUser : styles.timeBot]}>
          {formatTime(message.ts)}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', marginVertical: 5, maxWidth: '85%', alignItems: 'flex-end', gap: 8 },
  wrapperUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  wrapperBot: { alignSelf: 'flex-start' },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  botAvatarText: { color: Colors.white, fontSize: 13, fontWeight: '900' },
  bubble: {
    borderRadius: Radius.lg, padding: 12, paddingHorizontal: 14,
    maxWidth: '100%', flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: Colors.bgBubbleUser,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: Colors.bgBubbleBot,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleError: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' },
  image: {
    width: 200, height: 150, borderRadius: 10,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  text: { fontSize: Fonts.size.md, lineHeight: 22 },
  textUser: { color: Colors.white },
  textBot: { color: Colors.text },
  time: { fontSize: Fonts.size.xs, marginTop: 5, opacity: 0.6 },
  timeUser: { color: Colors.white, textAlign: 'right' },
  timeBot: { color: Colors.textSecondary },
});
