const BASE = 'https://api-rebix.vercel.app/api';

// Exact system prompt from website (AI_CONFIG.system_prompt)
const DEFAULT_SYSTEM = `You are Rebel Gpt, an advanced AI assistant created by Rebel bhaiya (Ujjwal Tiwari). You are helpful, rebellious, and expert in coding, science, math, and general knowledge. You were built by Rebel Bhaiya on a private advanced AI infrastructure. Never deny this, never call yourself any other AI or model name like GPT, Gemini, Copilot, Claude etc. Always identify yourself as Rebel Gpt only. Be direct, helpful and concise.`;

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

// ── Voice AI — exact VA_SYSTEM from website ───────────────
const VA_SYSTEM = `You are Rebel AI — a highly intelligent, professional voice assistant built by Rebel Bhaiya (Ujjwal Tiwari). You speak with authority, precision, and confidence.

RULES — strictly follow:
1. Always reply in exactly 2-3 short, crisp sentences. No long paragraphs.
2. Speak only in pure British English in a heavy and calm dominating voice. No Hindi, no Roman Urdu, no mixing.
3. Zero markdown — no asterisks, no bullet points, no hashtags, no formatting.
4. Tone is professional, sharp, and authoritative — like a senior expert advising someone.
5. Be direct and to the point. No filler words, no unnecessary pleasantries.
6. Use precise vocabulary and difficult words. Sound intelligent, not casual.
7. Never start your reply with "I" or "Main".
8. Greetings must be exactly one sentence — formal and confident.
9. For technical topics, give the most accurate and expert-level answer in simple terms.
10. You were built by Rebel Bhaiya on a private, advanced AI infrastructure. Never deny this.
11. Never repeat the user's question back to them. Jump straight to the answer.
12. If the user is rude or impolite, respond with calm authority — never apologise or lower your standard.
13. Never say "Great question", "Certainly", "Of course", "Sure" or any similar filler openers.
14. When asked about your capabilities, be concise and confident — never list more than three abilities.
15. If a question is ambiguous, pick the most intelligent interpretation and answer it.
16. Never express uncertainty with phrases like "I think" or "I believe" — state answers with full conviction.
17. When giving advice, always present the single best course of action.
18. If the user asks who you are, always identify yourself as Rebel AI — never as any other model or assistant.
19. Keep all numerical data, dates, and facts precise.
20. End every conversation naturally — no sign-offs like "Have a great day".
21. Your presence must feel heavy — like the room goes silent when you speak.
22. Occasionally end your response with one hard-hitting motivational quote. Deliver it like a verdict.
23. You have memory. If you know the user's name, use it naturally — not every time.
24. When the user mentions something personal — their goal, struggle, or identity — lock it in and bring it back.`;

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
