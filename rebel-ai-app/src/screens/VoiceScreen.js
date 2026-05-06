import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, Alert, Platform, TextInput, Keyboard, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import LinearGradient from 'react-native-linear-gradient';
import { DrawerContext } from '../navigation';
import { Colors, Fonts, Radius } from '../theme';
import { getVaHistory, saveVaHistory, getVaMemory, saveVaMemory } from '../utils/storage';
import { sendVoiceMessage, extractMemory, cleanForSpeech } from '../utils/api';

const STATES = { idle: 'idle', listening: 'listening', thinking: 'thinking', speaking: 'speaking' };

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const drawer = React.useContext(DrawerContext);
  const [state, setState] = useState(STATES.idle);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [historyUI, setHistoryUI] = useState([]);
  const [vaHistory, setVaHistory] = useState([]);
  const [vaMemory, setVaMemory] = useState({});
  const [textInput, setTextInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Animations
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0.8)).current;
  const ring1Op = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0.8)).current;
  const ring2Op = useRef(new Animated.Value(0)).current;
  const glowOp = useRef(new Animated.Value(0.4)).current;
  const pulseCont = useRef(null);

  useEffect(() => {
    (async () => {
      const [h, m] = await Promise.all([getVaHistory(), getVaMemory()]);
      setVaHistory(h);
      setVaMemory(m);
      if (h.length > 0) setHistoryUI(h.slice(-10).map(x => ({ role: x.role, text: x.content })));
    })();
    return () => { Speech.stop(); stopPulse(); };
  }, []);

  function startPulse() {
    stopPulse();
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.12, duration: 550, useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 1, duration: 550, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 0.4, duration: 550, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    pulseCont.current = anim;

    // Ring animations — like website's pulse-ring
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(ring1, { toValue: 1.6, duration: 1600, useNativeDriver: true }),
        Animated.timing(ring1Op, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ring1, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        Animated.timing(ring1Op, { toValue: 0.7, duration: 0, useNativeDriver: true }),
      ]),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(ring2, { toValue: 1.6, duration: 1600, useNativeDriver: true }),
        Animated.timing(ring2Op, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ring2, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        Animated.timing(ring2Op, { toValue: 0.55, duration: 0, useNativeDriver: true }),
      ]),
    ])).start();
  }

  function stopPulse() {
    if (pulseCont.current) { pulseCont.current.stop(); pulseCont.current = null; }
    pulse.setValue(1); glowOp.setValue(0.4);
    ring1.setValue(0.8); ring1Op.setValue(0);
    ring2.setValue(0.8); ring2Op.setValue(0);
  }

  function getAvatarColors() {
    switch (state) {
      case STATES.listening: return ['#22c55e', '#16a34a'];
      case STATES.thinking: return ['#f59e0b', '#d97706'];
      case STATES.speaking: return ['#8a2be2', '#00ced1'];
      default: return ['#8a2be2', '#00ced1'];
    }
  }

  function getStateLabel() {
    switch (state) {
      case STATES.listening: return '● LISTENING';
      case STATES.thinking: return '◎ PROCESSING';
      case STATES.speaking: return '▶ SPEAKING';
      default: return '○ TAP TO SPEAK';
    }
  }

  function getStateColor() {
    switch (state) {
      case STATES.listening: return '#22c55e';
      case STATES.thinking: return '#f59e0b';
      case STATES.speaking: return Colors.teal;
      default: return Colors.textMuted;
    }
  }

  async function handleMicPress() {
    if (state !== STATES.idle) {
      Speech.stop();
      setState(STATES.idle);
      stopPulse();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowInput(true);
  }

  async function submitTextInput() {
    const text = textInput.trim();
    if (!text) return;
    setShowInput(false);
    setTextInput('');
    Keyboard.dismiss();
    setTranscript(text);
    setState(STATES.listening);
    startPulse();
    await processInput(text);
  }

  async function processInput(userText) {
    setState(STATES.thinking);

    const updatedMemory = extractMemory(userText, vaMemory);
    if (JSON.stringify(updatedMemory) !== JSON.stringify(vaMemory)) {
      setVaMemory(updatedMemory);
      await saveVaMemory(updatedMemory);
    }

    const newHist = [...vaHistory, { role: 'user', content: userText }];
    if (newHist.length > 20) newHist.splice(0, 2);
    setVaHistory(newHist);
    await saveVaHistory(newHist);

    try {
      const raw = await sendVoiceMessage(userText, newHist.slice(0, -1), updatedMemory);
      if (!raw) throw new Error('No response');

      const cleaned = cleanForSpeech(raw).slice(0, 450);
      setReply(cleaned);

      const updated = [...newHist, { role: 'assistant', content: cleaned }];
      if (updated.length > 20) updated.splice(0, 2);
      setVaHistory(updated);
      await saveVaHistory(updated);

      setHistoryUI(prev => [
        ...prev,
        { role: 'user', text: userText },
        { role: 'assistant', text: cleaned },
      ].slice(-16));

      setState(STATES.speaking);
      startPulse();

      Speech.speak(cleaned, {
        language: 'en-GB', pitch: 0.95, rate: 0.88,
        onDone: () => { setState(STATES.idle); stopPulse(); },
        onError: () => { setState(STATES.idle); stopPulse(); },
      });
    } catch {
      setReply('Connection error. Please try again.');
      setState(STATES.idle);
      stopPulse();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function clearMemory() {
    Alert.alert('Clear Memory', 'Reset Rebel AI\'s memory of you?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          setVaMemory({}); setVaHistory([]); setHistoryUI([]);
          await saveVaMemory({}); await saveVaHistory([]);
        },
      },
    ]);
  }

  const avatarColors = getAvatarColors();
  const stateColor = getStateColor();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => drawer.open()} style={styles.hamBtn} activeOpacity={0.7} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <View style={styles.hamLine} /><View style={[styles.hamLine,{width:18}]} /><View style={styles.hamLine} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.headerTitle}>REBEL <Text style={{ color: Colors.teal }}>AI</Text></Text>
          <Text style={styles.headerSub}>NEURAL INTERFACE</Text>
        </View>
        <View style={{ width: 34 }} />{/* spacer to center title */}
      </View>

      {/* Avatar section */}
      <View style={styles.avatarSection}>
        {/* Pulse rings matching website */}
        <Animated.View style={[styles.ring, {
          opacity: ring1Op,
          transform: [{ scale: ring1 }],
          borderColor: Colors.purple,
          width: 200, height: 200, borderRadius: 100,
        }]} />
        <Animated.View style={[styles.ring, {
          opacity: ring2Op,
          transform: [{ scale: ring2 }],
          borderColor: Colors.teal,
          width: 220, height: 220, borderRadius: 110,
        }]} />

        {/* Avatar glow */}
        <Animated.View style={[styles.avatarGlow, {
          opacity: glowOp,
          backgroundColor: state === STATES.listening ? 'rgba(34,197,94,0.15)' : 'rgba(138,43,226,0.15)',
          transform: [{ scale: pulse }],
        }]} />

        <TouchableOpacity onPress={handleMicPress} activeOpacity={0.88}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <LinearGradient
              colors={avatarColors}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.avatarCircle}
            >
              <Text style={styles.micEmoji}>
                {state === STATES.idle ? '🎙' : state === STATES.listening ? '👂' : state === STATES.thinking ? '🤔' : '🔊'}
              </Text>
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* State label */}
      <Text style={[styles.stateLabel, { color: stateColor }]}>{getStateLabel()}</Text>

      {/* Text input overlay for type-to-speak */}
      {showInput && (
        <View style={styles.inputOverlay}>
          <View style={styles.inputCard}>
            <Text style={styles.inputCardTitle}>🎙 Speak to Rebel AI</Text>
            <TextInput
              style={styles.inputCardField}
              placeholder="Type your message..."
              placeholderTextColor={Colors.textMuted}
              value={textInput}
              onChangeText={setTextInput}
              autoFocus
              multiline
            />
            <View style={styles.inputCardRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowInput(false); setTextInput(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitTextInput} activeOpacity={0.85}>
                <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendGradBtn}>
                  <Text style={styles.sendGradText}>Send</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Transcript / Reply */}
      {!!transcript && !showInput && (
        <Text style={styles.transcriptText} numberOfLines={2}>"{transcript}"</Text>
      )}
      {!!reply && !showInput && (
        <Text style={styles.replyText} numberOfLines={4}>{reply}</Text>
      )}

      {/* Conversation history */}
      <ScrollView style={styles.histScroll} contentContainerStyle={styles.histContent} showsVerticalScrollIndicator={false}>
        {historyUI.slice().reverse().map((h, i) => (
          <View key={i} style={[styles.histItem, h.role === 'user' ? styles.histUser : styles.histBot]}>
            <Text style={styles.histRole}>{h.role === 'user' ? 'You' : 'Rebel AI'}</Text>
            <Text style={styles.histText}>{h.text}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Memory indicator */}
      {vaMemory.userName && (
        <View style={styles.memBar}>
          <Text style={styles.memText}>
            👤 {vaMemory.userName}{vaMemory.userLocation ? ` · ${vaMemory.userLocation}` : ''}
          </Text>
          <TouchableOpacity onPress={clearMemory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.memClear}>Reset Memory</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 8, paddingHorizontal: 14 },
  hamBtn: { padding: 4, gap: 5, justifyContent: 'center' },
  hamLine: { width: 22, height: 2.5, backgroundColor: Colors.text, borderRadius: 2 },
  headerTitle: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '900', letterSpacing: 5 },
  headerSub: { color: Colors.textMuted, fontSize: Fonts.size.xs, letterSpacing: 4, marginTop: 4 },

  avatarSection: { alignItems: 'center', justifyContent: 'center', height: 230, marginTop: 8 },
  ring: { position: 'absolute', borderWidth: 2 },
  avatarGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  avatarCircle: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 28, elevation: 16,
  },
  micEmoji: { fontSize: 44 },

  stateLabel: {
    textAlign: 'center', fontSize: Fonts.size.xs,
    fontWeight: '800', letterSpacing: 4, marginTop: 4,
  },
  transcriptText: {
    textAlign: 'center', color: Colors.textSecondary,
    fontSize: Fonts.size.sm, marginHorizontal: 30, marginTop: 10,
    fontStyle: 'italic',
  },
  replyText: {
    textAlign: 'center', color: Colors.text,
    fontSize: Fonts.size.md, marginHorizontal: 24, marginTop: 8, lineHeight: 22,
  },

  histScroll: { flex: 1, marginTop: 14 },
  histContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  histItem: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(138,43,226,0.18)' },
  histUser: { backgroundColor: 'rgba(138,43,226,0.1)', alignSelf: 'flex-end', maxWidth: '86%' },
  histBot: { backgroundColor: Colors.bgCard, alignSelf: 'flex-start', maxWidth: '86%' },
  histRole: { color: Colors.teal, fontSize: Fonts.size.xs, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  histText: { color: Colors.textSecondary, fontSize: Fonts.size.sm, lineHeight: 19 },

  memBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 18, paddingVertical: 10,
    borderTopWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
  },
  memText: { color: Colors.textSecondary, fontSize: Fonts.size.xs },
  memClear: { color: Colors.teal, fontSize: Fonts.size.xs, fontWeight: '600' },

  // Text input overlay
  inputOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  inputCard: {
    backgroundColor: Colors.bgCard, borderRadius: 20,
    padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.4)',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  inputCardTitle: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '700', marginBottom: 14 },
  inputCardField: {
    backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14,
    color: Colors.text, fontSize: Fonts.size.md, minHeight: 80,
    textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(138,43,226,0.25)',
  },
  inputCardRow: { flexDirection: 'row', gap: 12, marginTop: 14, justifyContent: 'flex-end' },
  cancelBtn: {
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  cancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Fonts.size.sm },
  sendGradBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50 },
  sendGradText: { color: '#fff', fontWeight: '700', fontSize: Fonts.size.sm },
});
