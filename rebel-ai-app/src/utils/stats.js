import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'rbl_usage_stats';

async function load() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? JSON.parse(v) : { totalMessages: 0, totalSessions: 0, firstUsed: null, dailyMsgs: {} };
  } catch { return { totalMessages: 0, totalSessions: 0, firstUsed: null, dailyMsgs: {} }; }
}
async function save(s) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export async function trackMessage() {
  const s = await load();
  s.totalMessages = (s.totalMessages || 0) + 1;
  if (!s.firstUsed) s.firstUsed = new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  s.dailyMsgs = s.dailyMsgs || {};
  s.dailyMsgs[today] = (s.dailyMsgs[today] || 0) + 1;
  await save(s);
}

export async function trackSession() {
  const s = await load();
  s.totalSessions = (s.totalSessions || 0) + 1;
  await save(s);
}

export async function getStats() {
  const s = await load();
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = s.dailyMsgs?.[today] || 0;
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    last7.push({ date: k, label: d.toLocaleDateString('en-IN', { weekday: 'short' }), count: s.dailyMsgs?.[k] || 0 });
  }
  return { totalMessages: s.totalMessages || 0, totalSessions: s.totalSessions || 0, firstUsed: s.firstUsed, todayCount, last7 };
}
