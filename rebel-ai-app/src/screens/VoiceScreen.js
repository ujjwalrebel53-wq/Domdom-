// ChatGPT Voice Mode — ElevenLabs Callum TTS + Speech Recognition
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Platform, TextInput, Keyboard, Alert, StatusBar, Dimensions,
  PermissionsAndroid,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '../theme';
import { getVaHistory, saveVaHistory, getVaMemory, saveVaMemory } from '../utils/storage';
import { sendVoiceMessage, extractMemory, cleanForSpeech } from '../utils/api';
import { speakText, stopSpeaking } from '../utils/tts';
import { logInfo, logError } from '../utils/logger';

const { width: SW, height: SH } = Dimensions.get('window');

const S = { idle: 0, listening: 1, thinking: 2, speaking: 3 };
const S_COLORS  = { 0: '#3a3a3a', 1: '#1d4ed8', 2: '#7c3aed', 3: '#10a37f' };
const S_LABELS  = { 0: 'Tap to speak', 1: 'Listening...', 2: 'Thinking...', 3: 'Speaking...' };

export default function VoiceScreen({ navigation }) {
  const [state, setState] = useState(S.idle);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [vaHistory, setVaHistory] = useState([]);
  const [vaMemory, setVaMemory] = useState({});
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState(null);

  const orbScale = useRef(new Animated.Value(1)).current;
  const w1Scale  = useRef(new Animated.Value(1)).current;
  const w1Op     = useRef(new Animated.Value(0)).current;
  const w2Scale  = useRef(new Animated.Value(1)).current;
  const w2Op     = useRef(new Animated.Value(0)).current;
  const w3Scale  = useRef(new Animated.Value(1)).current;
  const w3Op     = useRef(new Animated.Value(0)).current;
  const waveLoop = useRef([]);

  useEffect(() => {
    (async () => {
      const [h, m] = await Promise.all([getVaHistory(), getVaMemory()]);
      setVaHistory(h); setVaMemory(m);
      // Request mic permission on mount
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      }
      await Audio.requestPermissionsAsync();
    })();
    return () => { stopSpeaking(); stopWaves(); stopRecording(); };
  }, []);

  function startWaves() {
    stopWaves();
    const mk = (s, o, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(s, { toValue: 2.4, duration: 1500, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(s, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.55, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    const a1 = mk(w1Scale, w1Op, 0);
    const a2 = mk(w2Scale, w2Op, 450);
    const a3 = mk(w3Scale, w3Op, 900);
    a1.start(); a2.start(); a3.start();
    waveLoop.current = [a1, a2, a3];
    Animated.loop(Animated.sequence([
      Animated.timing(orbScale, { toValue: 1.07, duration: 650, useNativeDriver: true }),
      Animated.timing(orbScale, { toValue: 1, duration: 650, useNativeDriver: true }),
    ])).start();
  }

  function stopWaves() {
    waveLoop.current.forEach(a => a?.stop());
    waveLoop.current = [];
    orbScale.setValue(1);
    w1Scale.setValue(1); w1Op.setValue(0);
    w2Scale.setValue(1); w2Op.setValue(0);
    w3Scale.setValue(1); w3Op.setValue(0);
  }

  // ── Speech Recognition via expo-av recording + Whisper API ──
  async function startRecording() {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      logInfo('Voice: recording started');
    } catch (e) {
      logError('Voice: mic failed', e.message);
      setShowInput(true); // Fallback to text input
    }
  }

  async function stopRecording() {
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      return uri;
    } catch { setRecording(null); return null; }
  }

  async function transcribeAudio(uri) {
    // Try Whisper via RapidAPI or similar free endpoint
    try {
      const formData = new FormData();
      formData.append('file', { uri, type: 'audio/m4a', name: 'audio.m4a' });
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const resp = await fetch('https://api-rebix.vercel.app/api/whisper', {
        method: 'POST', body: formData,
        headers: { 'Accept': 'application/json' },
      });
      if (resp.ok) {
        const d = await resp.json();
        const text = d?.text || d?.transcript || d?.result;
        if (text?.trim()) return text.trim();
      }
    } catch {}
    return null;
  }

  async function handleOrbPress() {
    if (state === S.speaking) {
      stopSpeaking();
      setState(S.idle); stopWaves();
      logInfo('Voice: user stopped speaking');
      return;
    }
    if (state === S.listening) {
      // Stop recording and process
      setState(S.thinking); startWaves();
      const uri = await stopRecording();
      if (uri) {
        const text = await transcribeAudio(uri);
        if (text) {
          setTranscript(text);
          await processInput(text);
        } else {
          // Transcription failed — show text input
          setState(S.idle); stopWaves();
          setShowInput(true);
        }
      } else {
        setState(S.idle); stopWaves();
        setShowInput(true);
      }
      return;
    }
    if (state !== S.idle) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState(S.listening); startWaves();
    logInfo('Voice: mic pressed');
    await startRecording();
  }

  function handleLongPress() {
    // Long press always opens text input as fallback
    setShowInput(true);
  }

  async function submitTextInput() {
    const text = inputText.trim();
    if (!text) { setShowInput(false); return; }
    setShowInput(false); setInputText('');
    Keyboard.dismiss();
    setTranscript(text);
    setState(S.listening); startWaves();
    await processInput(text);
  }

  async function processInput(text) {
    setState(S.thinking);
    logInfo(`Voice input: ${text.slice(0, 60)}`);

    const updMem = extractMemory(text, vaMemory);
    if (JSON.stringify(updMem) !== JSON.stringify(vaMemory)) {
      setVaMemory(updMem); await saveVaMemory(updMem);
    }

    const newHist = [...vaHistory, { role: 'user', content: text }].slice(-20);
    setVaHistory(newHist); await saveVaHistory(newHist);

    try {
      const raw = await sendVoiceMessage(text, newHist.slice(0, -1), updMem);
      if (!raw) throw new Error('No response');
      const clean = cleanForSpeech(raw).slice(0, 500);
      setReply(clean);
      logInfo(`Voice AI reply: ${clean.slice(0, 60)}`);

      const updated = [...newHist, { role: 'assistant', content: clean }].slice(-20);
      setVaHistory(updated); await saveVaHistory(updated);

      setState(S.speaking); startWaves();

      // Use ElevenLabs Callum (same as website)
      await speakText(clean, {
        onStart: () => { setState(S.speaking); },
        onEnd:   () => { setState(S.idle); stopWaves(); },
        onError: () => { setState(S.idle); stopWaves(); },
      });
    } catch (e) {
      logError('Voice AI failed', e.message);
      setReply('Connection error. Please try again.');
      setState(S.idle); stopWaves();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const col = S_COLORS[state];
  const ORB = Math.min(SW * 0.42, 170);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => { stopSpeaking(); stopRecording(); navigation.goBack(); }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Rebel AI Voice</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Orb */}
      <View style={styles.orbArea}>
        {[[w1Scale, w1Op], [w2Scale, w2Op], [w3Scale, w3Op]].map(([s, o], i) => (
          <Animated.View key={i} style={[styles.waveRing, { opacity: o, transform: [{ scale: s }], borderColor: col, width: ORB, height: ORB, borderRadius: ORB / 2 }]} />
        ))}
        <TouchableOpacity onPress={handleOrbPress} onLongPress={handleLongPress} activeOpacity={0.88} delayLongPress={600}>
          <Animated.View style={[styles.orb, { width: ORB, height: ORB, borderRadius: ORB / 2, backgroundColor: col, shadowColor: col, transform: [{ scale: orbScale }] }]}>
            <Text style={{ fontSize: ORB * 0.35 }}>
              {state === S.idle ? '🎙' : state === S.listening ? '🔴' : state === S.thinking ? '⋯' : '🔊'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* State label */}
      <Text style={[styles.stateLabel, { color: state === S.idle ? Colors.textSecondary : Colors.text }]}>
        {STATE_LABELS[state]}
      </Text>
      {state === S.listening && recording && (
        <Text style={styles.recordingHint}>Tap orb again to stop & send</Text>
      )}
      {state === S.idle && (
        <Text style={styles.hintText}>Long press for text input</Text>
      )}

      {/* Conversation */}
      <View style={styles.textArea}>
        {!!transcript && (
          <View style={styles.userBubble}>
            <Text style={styles.bubbleRole}>You</Text>
            <Text style={styles.bubbleText}>{transcript}</Text>
          </View>
        )}
        {!!reply && (
          <View style={styles.aiBubble}>
            <View style={styles.aiAv}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>R</Text></View>
            <Text style={styles.aiText}>{reply}</Text>
          </View>
        )}
      </View>

      {/* Memory badge */}
      {vaMemory.userName && (
        <View style={styles.memBar}>
          <Text style={styles.memText}>Remembers: {vaMemory.userName}</Text>
          <TouchableOpacity onPress={async () => { setVaMemory({}); setVaHistory([]); await saveVaMemory({}); await saveVaHistory([]); }}>
            <Text style={styles.memReset}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Text input overlay */}
      {showInput && (
        <View style={styles.overlay}>
          <View style={styles.inputCard}>
            <Text style={styles.inputTitle}>Type your message</Text>
            <TextInput style={styles.inputField} placeholder="Ask Rebel AI anything..." placeholderTextColor={Colors.textMuted} value={inputText} onChangeText={setInputText} autoFocus multiline />
            <View style={styles.inputBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowInput(false); setInputText(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={submitTextInput}>
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const STATE_LABELS = S_LABELS; // re-export for JSX

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 14 : 12, paddingBottom: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: Colors.text, fontSize: 16 },
  topTitle: { color: Colors.textSecondary, fontSize: Fonts.size.sm, fontWeight: '600' },
  orbArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waveRing: { position: 'absolute', borderWidth: 2 },
  orb: { alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 40, elevation: 20 },
  stateLabel: { fontSize: Fonts.size.sm, fontWeight: '600', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' },
  recordingHint: { color: Colors.error, fontSize: Fonts.size.xs, marginBottom: 4 },
  hintText: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginBottom: 4 },
  textArea: { width: '100%', paddingHorizontal: 20, paddingBottom: 16, gap: 10, maxHeight: SH * 0.27 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.bgCard, borderRadius: 16, padding: 12, maxWidth: '82%' },
  bubbleRole: { color: Colors.accent, fontSize: Fonts.size.xs, fontWeight: '700', marginBottom: 4 },
  bubbleText: { color: Colors.text, fontSize: Fonts.size.md },
  aiBubble: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  aiAv: { width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  aiText: { color: Colors.text, fontSize: Fonts.size.md, flex: 1, lineHeight: 22 },
  memBar: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderColor: Colors.borderSubtle, width: '100%', justifyContent: 'center', marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  memText: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  memReset: { color: Colors.accent, fontSize: Fonts.size.xs, fontWeight: '600' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'flex-end', padding: 20, paddingBottom: 40 },
  inputCard: { backgroundColor: Colors.bgCard, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: Colors.border },
  inputTitle: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '600', marginBottom: 12 },
  inputField: { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, color: Colors.text, fontSize: Fonts.size.md, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  inputBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  cancelBtn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Fonts.size.sm },
  sendBtn: { paddingVertical: 11, paddingHorizontal: 24, borderRadius: 10, backgroundColor: Colors.accent },
  sendText: { color: '#fff', fontWeight: '700', fontSize: Fonts.size.sm },
});
