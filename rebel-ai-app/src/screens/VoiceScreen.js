import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  ScrollView, Alert, Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius, Shadow } from '../theme';
import { getVaHistory, saveVaHistory, getVaMemory, saveVaMemory } from '../utils/storage';
import { sendVoiceMessage, extractMemory, cleanForSpeech } from '../utils/api';

const { width } = Dimensions.get('window');

const STATES = { idle: 'idle', listening: 'listening', thinking: 'thinking', speaking: 'speaking' };

export default function VoiceScreen() {
  const [state, setState] = useState(STATES.idle);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [history, setHistory] = useState([]);
  const [vaHistory, setVaHistory] = useState([]);
  const [vaMemory, setVaMemory] = useState({});
  const [isSpeaking, setIsSpeaking] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const pulseAnim = useRef(null);

  useEffect(() => {
    (async () => {
      const h = await getVaHistory();
      const m = await getVaMemory();
      setVaHistory(h);
      setVaMemory(m);
    })();
    return () => { Speech.stop(); stopPulse(); };
  }, []);

  function startPulse() {
    stopPulse();
    pulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.9, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        ]),
      ])
    );
    pulseAnim.current.start();
  }

  function stopPulse() {
    if (pulseAnim.current) { pulseAnim.current.stop(); pulseAnim.current = null; }
    pulse.setValue(1); glowOpacity.setValue(0.4);
  }

  function getAvatarColor() {
    switch (state) {
      case STATES.listening: return '#22c55e';
      case STATES.thinking: return '#f59e0b';
      case STATES.speaking: return Colors.accent;
      default: return Colors.accent;
    }
  }

  function getStateLabel() {
    switch (state) {
      case STATES.listening: return 'Listening...';
      case STATES.thinking: return 'Thinking...';
      case STATES.speaking: return 'Speaking...';
      default: return 'Tap to Speak';
    }
  }

  async function handleMicPress() {
    if (state !== STATES.idle) {
      // Stop speaking
      Speech.stop();
      setState(STATES.idle);
      stopPulse();
      setIsSpeaking(false);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState(STATES.listening);
    startPulse();

    // On real device Speech Recognition works via expo-speech or react-native-voice
    // For now we simulate a demo if no input, otherwise use a prompt
    Alert.prompt(
      '🎙 Rebel AI',
      'Type your message (voice input simulation):',
      [
        { text: 'Cancel', onPress: () => { setState(STATES.idle); stopPulse(); }, style: 'cancel' },
        {
          text: 'Send',
          onPress: async (text) => {
            if (!text?.trim()) { setState(STATES.idle); stopPulse(); return; }
            setTranscript(text.trim());
            await processVoiceInput(text.trim());
          },
        },
      ],
      'plain-text',
    );
  }

  async function processVoiceInput(userText) {
    setState(STATES.thinking);

    // Update memory with new facts
    const updatedMemory = extractMemory(userText, vaMemory);
    if (JSON.stringify(updatedMemory) !== JSON.stringify(vaMemory)) {
      setVaMemory(updatedMemory);
      await saveVaMemory(updatedMemory);
    }

    // Add user to history
    const newHistory = [...vaHistory, { role: 'user', content: userText }];
    if (newHistory.length > 20) newHistory.splice(0, 2);
    setVaHistory(newHistory);
    await saveVaHistory(newHistory);

    try {
      const raw = await sendVoiceMessage(userText, newHistory.slice(0, -1), updatedMemory);
      if (!raw) throw new Error('No response received');

      const cleaned = cleanForSpeech(raw).slice(0, 450);
      setReply(cleaned);

      // Add to visible history
      const updated = [...newHistory, { role: 'assistant', content: cleaned }];
      if (updated.length > 20) updated.splice(0, 2);
      setVaHistory(updated);
      await saveVaHistory(updated);

      // Show in local UI history
      setHistory(prev => [
        ...prev,
        { role: 'user', text: userText },
        { role: 'assistant', text: cleaned },
      ].slice(-20));

      setState(STATES.speaking);
      setIsSpeaking(true);
      startPulse();

      Speech.speak(cleaned, {
        language: 'en-GB',
        pitch: 0.95,
        rate: 0.88,
        onDone: () => { setState(STATES.idle); stopPulse(); setIsSpeaking(false); },
        onError: () => { setState(STATES.idle); stopPulse(); setIsSpeaking(false); },
      });
    } catch (err) {
      setReply('Sorry, I could not reach the AI servers. Please try again.');
      setState(STATES.idle);
      stopPulse();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function clearMemory() {
    Alert.alert('Clear Memory', 'This will clear Rebel AI\'s memory of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          setVaMemory({}); setVaHistory([]); setHistory([]);
          await saveVaMemory({}); await saveVaHistory([]);
        },
      },
    ]);
  }

  const color = getAvatarColor();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>REBEL AI</Text>
        <Text style={styles.headerSub}>NEURAL INTERFACE</Text>
      </View>

      <View style={styles.avatarSection}>
        <Animated.View style={[styles.glowRing, { borderColor: color, opacity: glowOpacity, transform: [{ scale: pulse }] }]} />
        <Animated.View style={[styles.outerRing, { borderColor: color, transform: [{ scale: pulse }] }]} />
        <TouchableOpacity
          style={[styles.micCircle, { backgroundColor: color, shadowColor: color }]}
          onPress={handleMicPress}
          activeOpacity={0.82}
        >
          <Text style={styles.micIcon}>{state === STATES.idle ? '🎙' : state === STATES.listening ? '👂' : state === STATES.thinking ? '🤔' : '🔊'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.stateLabel, { color }]}>{getStateLabel()}</Text>

      {!!transcript && <Text style={styles.transcriptText} numberOfLines={2}>"{transcript}"</Text>}
      {!!reply && <Text style={styles.replyText} numberOfLines={4}>{reply}</Text>}

      <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContent}>
        {history.slice(-10).reverse().map((h, i) => (
          <View key={i} style={[styles.historyItem, h.role === 'user' ? styles.histUser : styles.histAI]}>
            <Text style={styles.histRole}>{h.role === 'user' ? 'You' : 'Rebel AI'}</Text>
            <Text style={styles.histText}>{h.text}</Text>
          </View>
        ))}
      </ScrollView>

      {vaMemory.userName && (
        <View style={styles.memoryBar}>
          <Text style={styles.memoryText}>
            👤 {vaMemory.userName}{vaMemory.userLocation ? ` · ${vaMemory.userLocation}` : ''}
          </Text>
          <TouchableOpacity onPress={clearMemory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearMem}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  headerTitle: { color: Colors.white, fontSize: Fonts.size.xl, fontWeight: '900', letterSpacing: 5 },
  headerSub: { color: Colors.textMuted, fontSize: Fonts.size.xs, letterSpacing: 4, marginTop: 4 },
  avatarSection: { alignItems: 'center', justifyContent: 'center', height: 220, marginTop: 10 },
  glowRing: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1,
  },
  outerRing: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2,
  },
  micCircle: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 24, elevation: 14,
  },
  micIcon: { fontSize: 40 },
  stateLabel: { textAlign: 'center', fontSize: Fonts.size.sm, fontWeight: '700', letterSpacing: 3, marginTop: 8 },
  transcriptText: {
    textAlign: 'center', color: Colors.textSecondary, fontSize: Fonts.size.sm,
    marginHorizontal: 30, marginTop: 12, fontStyle: 'italic',
  },
  replyText: {
    textAlign: 'center', color: Colors.text, fontSize: Fonts.size.md,
    marginHorizontal: 24, marginTop: 10, lineHeight: 22,
  },
  historyScroll: { flex: 1, marginTop: 16 },
  historyContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  historyItem: {
    borderRadius: Radius.md, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  histUser: { backgroundColor: 'rgba(124,58,237,0.12)', alignSelf: 'flex-end', maxWidth: '85%' },
  histAI: { backgroundColor: Colors.bgCard, alignSelf: 'flex-start', maxWidth: '85%' },
  histRole: { color: Colors.accent, fontSize: Fonts.size.xs, fontWeight: '700', marginBottom: 4 },
  histText: { color: Colors.text, fontSize: Fonts.size.sm, lineHeight: 19 },
  memoryBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 18, paddingVertical: 10,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  memoryText: { color: Colors.textSecondary, fontSize: Fonts.size.xs },
  clearMem: { color: Colors.textMuted, fontSize: 14 },
});
