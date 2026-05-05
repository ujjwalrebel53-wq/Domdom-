import AsyncStorage from '@react-native-async-storage/async-storage';

const CONV_LIST_KEY = 'rbl_conversations';
const CONV_MSG_KEY = id => `rbl_conv_msgs_${id}`;

// ── Conversation list ────────────────────────────────────
export async function getConversations() {
  try {
    const v = await AsyncStorage.getItem(CONV_LIST_KEY);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

export async function saveConversations(list) {
  try { await AsyncStorage.setItem(CONV_LIST_KEY, JSON.stringify(list)); } catch {}
}

export async function createConversation(title) {
  const id = `conv_${Date.now()}`;
  const conv = {
    id, title: title || 'New Chat',
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  const list = await getConversations();
  list.unshift(conv);
  await saveConversations(list);
  return conv;
}

export async function updateConversationTitle(id, title) {
  const list = await getConversations();
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) { list[idx].title = title; list[idx].updatedAt = Date.now(); }
  await saveConversations(list);
}

export async function deleteConversation(id) {
  let list = await getConversations();
  list = list.filter(c => c.id !== id);
  await saveConversations(list);
  try { await AsyncStorage.removeItem(CONV_MSG_KEY(id)); } catch {}
}

export async function deleteAllConversations() {
  const list = await getConversations();
  await Promise.all(list.map(c => AsyncStorage.removeItem(CONV_MSG_KEY(c.id))));
  await AsyncStorage.removeItem(CONV_LIST_KEY);
}

// ── Messages per conversation ────────────────────────────
export async function getMessages(convId) {
  try {
    const v = await AsyncStorage.getItem(CONV_MSG_KEY(convId));
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

export async function addMessage(convId, role, content, image) {
  let msgs = await getMessages(convId);
  const msg = { id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`, role, content, image, ts: Date.now() };
  msgs.push(msg);
  if (msgs.length > 200) msgs = msgs.slice(-200);
  try { await AsyncStorage.setItem(CONV_MSG_KEY(convId), JSON.stringify(msgs)); } catch {}
  // Update conv timestamp + auto title from first user message
  const list = await getConversations();
  const idx = list.findIndex(c => c.id === convId);
  if (idx !== -1) {
    list[idx].updatedAt = Date.now();
    if (list[idx].title === 'New Chat' && role === 'user') {
      list[idx].title = content.slice(0, 40) + (content.length > 40 ? '…' : '');
    }
    await saveConversations(list);
  }
  return msg;
}

export async function clearMessages(convId) {
  try { await AsyncStorage.removeItem(CONV_MSG_KEY(convId)); } catch {}
  const list = await getConversations();
  const idx = list.findIndex(c => c.id === convId);
  if (idx !== -1) { list[idx].title = 'New Chat'; list[idx].updatedAt = Date.now(); await saveConversations(list); }
}

// Group conversations by date
export function groupByDate(convList) {
  const now = Date.now();
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = today - 86400000;
  const week = today - 7 * 86400000;
  const month = today - 30 * 86400000;

  const groups = { Today: [], Yesterday: [], 'Previous 7 Days': [], 'Previous 30 Days': [], Older: [] };
  convList.forEach(c => {
    const t = c.updatedAt;
    if (t >= today) groups.Today.push(c);
    else if (t >= yesterday) groups.Yesterday.push(c);
    else if (t >= week) groups['Previous 7 Days'].push(c);
    else if (t >= month) groups['Previous 30 Days'].push(c);
    else groups.Older.push(c);
  });
  return Object.entries(groups).filter(([, v]) => v.length > 0);
}
