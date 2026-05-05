import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  chatHistory: email => `rbl_chat_history_${email || 'guest'}`,
  currentUser: 'rbl_current_user',
  users: 'rbl_users_v3',
  settings: 'rbl_settings',
  vaHistory: 'rebel_va_history',
  vaMemory: 'rebel_va_memory',
};

export async function get(key) {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function set(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function remove(key) {
  try { await AsyncStorage.removeItem(key); } catch {}
}

// ── Chat History ──────────────────────────────────────────
const MAX_CHAT = 40;

export async function getChatHistory(email) {
  return (await get(KEYS.chatHistory(email))) || [];
}

export async function addChatMessage(email, role, content) {
  let history = await getChatHistory(email);
  history.push({ role, content, ts: Date.now() });
  if (history.length > MAX_CHAT) history = history.slice(-MAX_CHAT);
  await set(KEYS.chatHistory(email), history);
  return history;
}

export async function saveChatHistory(email, history) {
  if (history.length > MAX_CHAT) history = history.slice(-MAX_CHAT);
  await set(KEYS.chatHistory(email), history);
}

export async function clearChatHistory(email) {
  await remove(KEYS.chatHistory(email));
}

// ── User ──────────────────────────────────────────────────
export async function getCurrentUser() {
  return await get(KEYS.currentUser);
}

export async function saveCurrentUser(user) {
  await set(KEYS.currentUser, user);
}

export async function getUsers() {
  return (await get(KEYS.users)) || [];
}

export async function registerOrLogin(name, email) {
  const users = await getUsers();
  let user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (user) {
    user.lastLogin = new Date().toISOString();
    user.loginCount = (user.loginCount || 0) + 1;
  } else {
    user = {
      id: Date.now().toString(),
      name, email,
      joined: new Date().toISOString().slice(0, 10),
      lastLogin: new Date().toISOString(),
      loginCount: 1,
      messages: 0,
    };
    users.push(user);
  }
  await set(KEYS.users, users);
  await saveCurrentUser(user);
  return user;
}

export async function logoutUser() {
  await remove(KEYS.currentUser);
}

// ── Settings ──────────────────────────────────────────────
export async function getSettings() {
  return (await get(KEYS.settings)) || {
    theme: 'dark',
    fontSize: 'md',
    haptics: true,
    sound: true,
    systemPrompt: '',
  };
}

export async function saveSettings(s) {
  await set(KEYS.settings, s);
}

// ── Voice Memory ──────────────────────────────────────────
export async function getVaMemory() {
  return (await get(KEYS.vaMemory)) || {};
}
export async function saveVaMemory(m) { await set(KEYS.vaMemory, m); }

export async function getVaHistory() {
  return (await get(KEYS.vaHistory)) || [];
}
export async function saveVaHistory(h) {
  await set(KEYS.vaHistory, h.slice(-20));
}
