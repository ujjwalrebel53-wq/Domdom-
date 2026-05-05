// APK → Website Admin Panel log reporter
// Sends logs to the same /api/* endpoints the website uses

const BACKEND = 'https://ujjwalrebel53-wq.github.io/Domdom-';
// Also try the direct backend if configured
const BACKENDS = [
  'https://domdom-backend.vercel.app',
  'https://api-rebix.vercel.app',
];

const DEVICE_ID = (() => {
  // Generate stable device ID stored in AsyncStorage
  return 'apk_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
})();

// Queue logs in memory, flush every 30s or when 10+ logs accumulate
let logQueue = [];
let flushTimer = null;

export function log(level, msg, extra) {
  const entry = {
    ts: Date.now(),
    level: level || 'info',
    msg,
    extra: extra || null,
    source: 'apk',
    deviceId: DEVICE_ID,
  };
  logQueue.push(entry);
  if (logQueue.length >= 10) flush();
  else {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 30000);
  }
}

export function logInfo(msg, extra)  { log('info',  msg, extra); }
export function logError(msg, extra) { log('error', msg, extra); }
export function logWarn(msg, extra)  { log('warn',  msg, extra); }

async function flush() {
  if (!logQueue.length) return;
  const batch = [...logQueue];
  logQueue = [];
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

  // Try each backend
  for (const base of BACKENDS) {
    try {
      const r = await fetch(`${base}/api/logs/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: batch }),
      });
      if (r.ok) return;
    } catch {}
  }

  // Fallback: send each individually (for simpler backends)
  for (const entry of batch) {
    for (const base of BACKENDS) {
      try {
        await fetch(`${base}/api/logs/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        break;
      } catch {}
    }
  }
}

// Track events: message sent, session start, errors
export async function trackMessageEvent(userEmail, messageText, responseMs, success) {
  logInfo(`MSG: ${messageText?.slice(0, 60)}`, { email: userEmail, ms: responseMs, ok: success });
  for (const base of BACKENDS) {
    try {
      fetch(`${base}/api/track/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: userEmail, type: 'text', response_ms: responseMs, source: 'apk' }),
      }).catch(() => {});
      fetch(`${base}/api/track/api-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_ms: responseMs, success, source: 'apk' }),
      }).catch(() => {});
    } catch {}
  }
}

export async function trackSessionStart(userEmail, userName) {
  logInfo(`SESSION START: ${userName} (${userEmail})`, { source: 'apk' });
  for (const base of BACKENDS) {
    try {
      fetch(`${base}/api/track/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: userEmail, user_name: userName, source: 'apk' }),
      }).catch(() => {});
    } catch {}
  }
}
