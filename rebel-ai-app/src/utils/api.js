const BASE = 'https://api-rebix.vercel.app/api';

const DEFAULT_SYSTEM = `You are Rebel Gpt, an advanced AI assistant created by Rebel Bhaiya (Ujjwal Tiwari). You are helpful, intelligent, and expert in coding, science, math, and general knowledge. Respond clearly and concisely.`;

function timeout(ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, clear: () => clearTimeout(t) };
}

// Build a full context-aware prompt for the GPT-5 endpoint
function buildChatPrompt(message, history, systemPrompt) {
  let p = (systemPrompt || DEFAULT_SYSTEM) + '\n\n';
  if (history && history.length > 0) {
    p += 'CONVERSATION HISTORY:\n';
    history.forEach(m => {
      p += `${m.role === 'user' ? 'User' : 'Rebel Gpt'}: ${m.content}\n`;
    });
    p += '\n';
  }
  p += `User: ${message}\nRebel Gpt:`;
  return p;
}

// ── Chat API ──────────────────────────────────────────────
export async function sendChatMessage(message, history, systemPrompt, imageBase64) {
  const prompt = buildChatPrompt(message, history, systemPrompt);
  let url = `${BASE}/gpt-5?q=${encodeURIComponent(prompt)}`;
  if (imageBase64) url += `&image=${encodeURIComponent(imageBase64)}`;
  const { signal, clear } = timeout(15000);
  try {
    const r = await fetch(url, { signal });
    clear();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d.status || !d.results) throw new Error('Invalid response');
    return d.results;
  } catch (e) {
    clear();
    // fallback endpoint
    const { signal: s2, clear: c2 } = timeout(12000);
    try {
      const r2 = await fetch(`${BASE}/gptlogic?q=${encodeURIComponent(prompt)}&prompt=${encodeURIComponent(systemPrompt || DEFAULT_SYSTEM)}`, { signal: s2 });
      c2();
      if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
      const d2 = await r2.json();
      const val = d2?.result || d2?.results || d2?.response || d2?.message || d2?.answer || d2?.text;
      if (val) return val;
      throw new Error('Empty fallback');
    } catch (e2) {
      c2();
      throw new Error('All APIs failed. Check connection.');
    }
  }
}

// ── Voice AI ──────────────────────────────────────────────
const VA_SYSTEM = `You are Rebel AI — a highly intelligent, professional voice assistant built by Rebel Bhaiya. You speak with authority, precision, and confidence. Reply in 2-3 short sentences only. No markdown, no bullet points. Pure British English.`;

export async function sendVoiceMessage(userText, vaHistory, vaMemory) {
  const memCtx = buildMemoryContext(vaMemory);
  const histCtx = buildVaHistoryContext(vaHistory);
  const fullPrompt = VA_SYSTEM + memCtx + histCtx + ' User: ' + userText + ' Reply in max 2 short sentences, no markdown.';
  const qEnc = encodeURIComponent(fullPrompt);

  const endpoints = [
    `${BASE}/gptlogic?q=${qEnc}&prompt=${encodeURIComponent(VA_SYSTEM + memCtx)}`,
    `${BASE}/gemini?q=${qEnc}`,
    `${BASE}/qwen?q=${qEnc}`,
    `${BASE}/gpt-5?q=${qEnc}`,
  ];

  function parse(d) {
    let v = d?.result || d?.results || d?.response || d?.message || d?.answer || d?.text || d?.content || d?.choices?.[0]?.message?.content || null;
    if (!v) return null;
    v = v.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    return v.length > 3 ? v : null;
  }

  return new Promise(resolve => {
    let settled = false, pending = endpoints.length;
    endpoints.forEach(url => {
      const { signal, clear } = timeout(8000);
      fetch(url, { signal })
        .then(async r => {
          clear();
          if (settled) return;
          if (!r.ok) { if (--pending === 0 && !settled) { settled = true; resolve(null); } return; }
          const d = await r.json().catch(() => null);
          if (!d) { if (--pending === 0 && !settled) { settled = true; resolve(null); } return; }
          const v = parse(d);
          if (v && !settled) { settled = true; resolve(v); }
          else if (--pending === 0 && !settled) { settled = true; resolve(null); }
        })
        .catch(() => { clear(); if (--pending === 0 && !settled) { settled = true; resolve(null); } });
    });
  });
}

function buildMemoryContext(vaMemory) {
  if (!vaMemory) return '';
  const facts = [];
  if (vaMemory.userName)       facts.push(`User's name is ${vaMemory.userName}`);
  if (vaMemory.userAge)        facts.push(`User is ${vaMemory.userAge} years old`);
  if (vaMemory.userProfession) facts.push(`User is a ${vaMemory.userProfession}`);
  if (vaMemory.userLocation)   facts.push(`User is from ${vaMemory.userLocation}`);
  return facts.length ? `\n\nUSER FACTS: ${facts.join('. ')}.` : '';
}

function buildVaHistoryContext(vaHistory) {
  if (!vaHistory || !vaHistory.length) return '';
  const recent = vaHistory.slice(-6);
  return '\n\nRECENT CONVERSATION:\n' + recent.map(m =>
    `${m.role === 'user' ? 'User' : 'Rebel AI'}: ${m.content}`
  ).join('\n');
}

export function extractMemory(text, vaMemory) {
  const mem = { ...vaMemory };
  const nameMatch = text.match(/(?:my name is|i am|i'm|call me)\s+([A-Za-z]+)/i);
  if (nameMatch) mem.userName = nameMatch[1];
  const ageMatch = text.match(/i(?:'m| am)\s+(\d{1,2})\s*(?:years old|yr)/i);
  if (ageMatch) mem.userAge = ageMatch[1];
  const profMatch = text.match(/i(?:'m| am) a\s+([a-zA-Z ]+?)(?:\.|,|$)/i);
  if (profMatch) mem.userProfession = profMatch[1].trim();
  const locMatch = text.match(/i(?:'m| am) from\s+([A-Za-z ]+?)(?:\.|,|$)/i);
  if (locMatch) mem.userLocation = locMatch[1].trim();
  return mem;
}

export function cleanForSpeech(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
