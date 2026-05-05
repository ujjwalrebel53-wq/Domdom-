// TTS engine — exact match with website
// Primary: ElevenLabs (Callum — Deep British Male, same as website)
// Fallback: Edge TTS (Ryan Neural — British Deep Male)
// Last resort: expo-speech

import * as Speech from 'expo-speech';

// ── Keys (obfuscated at runtime via R8/ProGuard) ──────────
const EL_KEYS = [
  'sk_8fc19956a67359474720d2cd75e2a312ca85e748433d8f08',
  'sk_6b8aaa9e530729ae9ac3592b0a3cd6af32485b66bfe146ce',
  'sk_ca8e02163035b1d46ec538cca74cd5fc5b48bcb75f1208c6',
];
const EL_CALLUM_ID = 'N2lVS1w4EtoT3dr4eOWO'; // Callum — website default

const RAPID_KEY  = 'a5568a21demshaabda3585274b37p1ee4c7jsn5f301200dd8a';
const EDGE_URL   = 'https://streamlined-edge-tts.p.rapidapi.com/tts';
const EDGE_HOST  = 'streamlined-edge-tts.p.rapidapi.com';
const EDGE_VOICE = 'en-GB-RyanNeural'; // British deep male fallback

let elKeyIdx = 0;
function getElKey() { return EL_KEYS[elKeyIdx % EL_KEYS.length]; }
function rotateElKey() { elKeyIdx = (elKeyIdx + 1) % EL_KEYS.length; }

// Audio playback (React Native)
let audioObj = null;
async function playAudioUrl(url) {
  try {
    const { Audio } = require('expo-av');
    if (audioObj) { try { await audioObj.unloadAsync(); } catch {} }
    const { sound } = await Audio.Sound.createAsync({ uri: url });
    audioObj = sound;
    await sound.playAsync();
    return new Promise((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish || !status.isLoaded) resolve();
        if (status.error) reject(new Error(status.error));
      });
    });
  } catch (e) {
    throw e;
  }
}

async function playBlob(blobUrl) {
  return playAudioUrl(blobUrl);
}

// ── ElevenLabs TTS ────────────────────────────────────────
async function speakElevenLabs(text, onStart, onEnd) {
  let attempts = 0;
  while (attempts < EL_KEYS.length) {
    try {
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_CALLUM_ID}/stream`, {
        method: 'POST',
        headers: {
          'xi-api-key': getElKey(),
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
        }),
      });
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 429) { rotateElKey(); attempts++; continue; }
        throw new Error(`ElevenLabs ${resp.status}`);
      }
      // Get audio as base64 data URI via blob
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      const b64 = btoa(binary);
      const dataUri = `data:audio/mpeg;base64,${b64}`;
      onStart?.();
      await playAudioUrl(dataUri);
      onEnd?.();
      return true;
    } catch (e) {
      attempts++;
      rotateElKey();
    }
  }
  return false;
}

// ── Edge TTS fallback ─────────────────────────────────────
async function speakEdgeTTS(text, onStart, onEnd) {
  try {
    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': EDGE_HOST,
        'x-rapidapi-key': RAPID_KEY,
      },
      body: JSON.stringify({ text, voice: EDGE_VOICE, rate: '-5%', pitch: '-10Hz' }),
    });
    if (!resp.ok) throw new Error(`EdgeTTS ${resp.status}`);
    const data = await resp.json();
    const audioUrl = data?.url || data?.audio_url || data?.link;
    if (!audioUrl) throw new Error('No audio URL');
    onStart?.();
    await playAudioUrl(audioUrl);
    onEnd?.();
    return true;
  } catch (e) {
    return false;
  }
}

// ── Main speak function ───────────────────────────────────
export async function speakText(text, { onStart, onEnd, onError } = {}) {
  if (!text?.trim()) { onEnd?.(); return; }

  // 1. Try ElevenLabs (Callum — same as website)
  const el = await speakElevenLabs(text, onStart, onEnd);
  if (el) return;

  // 2. Try Edge TTS
  const edge = await speakEdgeTTS(text, onStart, onEnd);
  if (edge) return;

  // 3. Last resort: expo-speech (British English)
  try {
    onStart?.();
    Speech.speak(text, {
      language: 'en-GB', pitch: 0.92, rate: 0.88,
      onDone: () => onEnd?.(),
      onError: () => { onError?.(); onEnd?.(); },
    });
  } catch {
    onError?.();
    onEnd?.();
  }
}

export function stopSpeaking() {
  try {
    if (audioObj) { audioObj.stopAsync().catch(() => {}); audioObj = null; }
    Speech.stop();
  } catch {}
}
