// ChatGPT Voice Mode — full screen orb
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Platform, TextInput, Keyboard, Alert, StatusBar, Dimensions,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '../theme';
import { getVaHistory, saveVaHistory, getVaMemory, saveVaMemory } from '../utils/storage';
import { sendVoiceMessage, extractMemory, cleanForSpeech } from '../utils/api';

const { width: SW, height: SH } = Dimensions.get('window');

const STATE = { idle: 0, listening: 1, thinking: 2, speaking: 3 };
const STATE_COLORS = {
  0: ['#3a3a3a', '#2f2f2f'],
  1: ['#1d4ed8', '#2563eb'],
  2: ['#6d28d9', '#7c3aed'],
  3: ['#047857', '#10a37f'],
};
const STATE_LABELS = { 0: 'Tap to speak', 1: 'Listening...', 2: 'Thinking...', 3: 'Speaking...' };

export default function VoiceScreen({ navigation }) {
  const [state, setState] = useState(STATE.idle);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [vaHistory, setVaHistory] = useState([]);
  const [vaMemory, setVaMemory] = useState({});
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');

  // Orb animations
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(1)).current;
  const wave1 = useRef(new Animated.Value(1)).current;
  const wave2 = useRef(new Animated.Value(1)).current;
  const wave3 = useRef(new Animated.Value(1)).current;
  const wave1Op = useRef(new Animated.Value(0)).current;
  const wave2Op = useRef(new Animated.Value(0)).current;
  const wave3Op = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef([]);

  useEffect(() => {
    (async () => {
      const [h, m] = await Promise.all([getVaHistory(), getVaMemory()]);
      setVaHistory(h); setVaMemory(m);
    })();
    return () => { Speech.stop(); stopWaves(); };
  }, []);

  function startWaves() {
    stopWaves();
    const makeWave = (scale, opacity, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(scale, { toValue: 2.2, duration: 1400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    const a1 = makeWave(wave1, wave1Op, 0);
    const a2 = makeWave(wave2, wave2Op, 400);
    const a3 = makeWave(wave3, wave3Op, 800);
    a1.start(); a2.start(); a3.start();
    waveAnims.current = [a1, a2, a3];

    Animated.loop(Animated.sequence([
      Animated.timing(orbScale, { toValue: 1.06, duration: 700, useNativeDriver: true }),
      Animated.timing(orbScale, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }

  function stopWaves() {
    waveAnims.current.forEach(a => a?.stop());
    waveAnims.current = [];
    orbScale.setValue(1);
    wave1.setValue(1); wave1Op.setValue(0);
    wave2.setValue(1); wave2Op.setValue(0);
    wave3.setValue(1); wave3Op.setValue(0);
  }

  const currentColors = STATE_COLORS[state];
  const orbColor = currentColors[0];
  const orbColor2 = currentColors[1];

  async function handleOrbPress() {
    if (state !== STATE.idle) {
      Speech.stop();
      setState(STATE.idle);
      stopWaves();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowInput(true);
  }

  async function submitInput() {
    const text = inputText.trim();
    if (!text) { setShowInput(false); return; }
    setShowInput(false); setInputText('');
    Keyboard.dismiss();
    setTranscript(text);
    setState(STATE.listening);
    startWaves();
    await processInput(text);
  }

  async function processInput(text) {
    setState(STATE.thinking);

    const updMem = extractMemory(text, vaMemory);
    if (JSON.stringify(updMem) !== JSON.stringify(vaMemory)) { setVaMemory(updMem); await saveVaMemory(updMem); }

    const newHist = [...vaHistory, { role: 'user', content: text }].slice(-20);
    setVaHistory(newHist);
    await saveVaHistory(newHist);

    try {
      const raw = await sendVoiceMessage(text, newHist.slice(0, -1), updMem);
      if (!raw) throw new Error();
      const clean = cleanForSpeech(raw).slice(0, 500);
      setReply(clean);

      const updated = [...newHist, { role: 'assistant', content: clean }].slice(-20);
      setVaHistory(updated);
      await saveVaHistory(updated);

      setState(STATE.speaking);
      startWaves();

      Speech.speak(clean, {
        language: 'en-GB', pitch: 0.95, rate: 0.9,
        onDone: () => { setState(STATE.idle); stopWaves(); },
        onError: () => { setState(STATE.idle); stopWaves(); },
      });
    } catch {
      setReply('Could not reach AI. Please try again.');
      setState(STATE.idle);
      stopWaves();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Close / back */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { Speech.stop(); navigation.goBack(); }} style={styles.closeBtn}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Rebel AI Voice</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main orb area */}
      <View style={styles.orbArea}>
        {/* Wave rings */}
        {[[wave1, wave1Op], [wave2, wave2Op], [wave3, wave3Op]].map(([s, o], i) => (
          <Animated.View key={i} style={[styles.waveRing, {
            opacity: o,
            transform: [{ scale: s }],
            borderColor: orbColor,
          }]} />
        ))}

        {/* Main orb */}
        <TouchableOpacity onPress={handleOrbPress} activeOpacity={0.9}>
          <Animated.View style={[styles.orb, { backgroundColor: orbColor, transform: [{ scale: orbScale }], shadowColor: orbColor }]}>
            <Text style={styles.orbIcon}>
              {state === STATE.idle ? '🎙' : state === STATE.listening ? '👂' : state === STATE.thinking ? '⋯' : '🔊'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* State label */}
      <Text style={[styles.stateLabel, { color: state === STATE.idle ? Colors.textSecondary : Colors.text }]}>
        {STATE_LABELS[state]}
      </Text>

      {/* Transcript / Reply */}
      <View style={styles.textArea}>
        {!!transcript && (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptRole}>You</Text>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        )}
        {!!reply && (
          <View style={styles.replyBox}>
            <View style={styles.replyAvatar}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>R</Text></View>
            <Text style={styles.replyText}>{reply}</Text>
          </View>
        )}
      </View>

      {/* Memory badge */}
      {vaMemory.userName && (
        <View style={styles.memBadge}>
          <Text style={styles.memText}>Remembers: {vaMemory.userName}</Text>
          <TouchableOpacity onPress={async () => {
            setVaMemory({}); setVaHistory([]);
            await saveVaMemory({}); await saveVaHistory([]);
          }}>
            <Text style={styles.memReset}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input overlay */}
      {showInput && (
        <View style={styles.inputOverlay}>
          <View style={styles.inputCard}>
            <Text style={styles.inputCardTitle}>What do you want to ask?</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Type your message..."
              placeholderTextColor={Colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              autoFocus multiline
            />
            <View style={styles.inputBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowInput(false); setInputText(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitInput}>
                <Text style={styles.submitText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const ORB_SIZE = Math.min(SW * 0.42, 180);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 14 : 12, paddingBottom: 10,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: Colors.text, fontSize: 16 },
  topTitle: { color: Colors.textSecondary, fontSize: Fonts.size.sm, fontWeight: '600' },

  orbArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waveRing: {
    position: 'absolute', width: ORB_SIZE, height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2, borderWidth: 2,
  },
  orb: {
    width: ORB_SIZE, height: ORB_SIZE, borderRadius: ORB_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 40, elevation: 20,
  },
  orbIcon: { fontSize: ORB_SIZE * 0.35 },

  stateLabel: { fontSize: Fonts.size.sm, fontWeight: '600', letterSpacing: 1, marginBottom: 20, textTransform: 'uppercase' },

  textArea: { width: '100%', paddingHorizontal: 20, paddingBottom: 16, gap: 12, maxHeight: SH * 0.28 },
  transcriptBox: { alignSelf: 'flex-end', backgroundColor: Colors.bgCard, borderRadius: 18, padding: 14, maxWidth: '85%' },
  transcriptRole: { color: Colors.accent, fontSize: Fonts.size.xs, fontWeight: '700', marginBottom: 4 },
  transcriptText: { color: Colors.text, fontSize: Fonts.size.md },
  replyBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  replyAvatar: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  replyText: { color: Colors.text, fontSize: Fonts.size.md, flex: 1, lineHeight: 22 },

  memBadge: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderColor: Colors.borderSubtle, width: '100%', justifyContent: 'center', marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  memText: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  memReset: { color: Colors.accent, fontSize: Fonts.size.xs, fontWeight: '600' },

  inputOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'flex-end', padding: 20, paddingBottom: 40 },
  inputCard: { backgroundColor: Colors.bgCard, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: Colors.border },
  inputCardTitle: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '600', marginBottom: 12 },
  inputField: { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, color: Colors.text, fontSize: Fonts.size.md, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  inputBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  cancelBtn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Fonts.size.sm },
  submitBtn: { paddingVertical: 11, paddingHorizontal: 24, borderRadius: 10, backgroundColor: Colors.accent },
  submitText: { color: '#fff', fontWeight: '700', fontSize: Fonts.size.sm },
});
