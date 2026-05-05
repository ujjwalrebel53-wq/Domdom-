
// ============================================================
//  CONFIG
// ============================================================

// Backend API base URL
const BACKEND_URL = window.location.origin;

const AI_CONFIG = {
  baseURL: 'https://api-rebix.vercel.app/api/gpt-5',
  endpoints: {
    'gpt-5'    : 'https://api-rebix.vercel.app/api/gpt-5',
    'gpt-4o'   : 'https://api-rebix.vercel.app/api/gpt-5',
    'gemini'   : 'https://api-rebix.vercel.app/api/gemini',
    'gptlogic' : 'https://api-rebix.vercel.app/api/gptlogic',
    'qwen'     : 'https://api-rebix.vercel.app/api/qwen',
    'copilot'  : 'https://api-rebix.vercel.app/api/copilot',
  },
  system_prompt: 'You are Rebel Gpt, an advanced AI assistant created by Rebel bhaiya. You are helpful, rebellious, and expert in coding. Format responses in Markdown when helpful — use code blocks, bold, lists etc.'
};

// ── Rate Limiting (client-side) ──────────────────────────────
const RateLimiter = (function() {
  const MAX_REQUESTS  = 20;  // max messages per window
  const WINDOW_MS     = 60 * 1000; // 1 minute window
  const K = 'rbl_rate_window';

  function check() {
    const now = Date.now();
    let w = null;
    try { w = JSON.parse(localStorage.getItem(K)); } catch(e) {}
    if (!w || now - w.start > WINDOW_MS) {
      w = { start: now, count: 0 };
    }
    if (w.count >= MAX_REQUESTS) {
      const remainMs = WINDOW_MS - (now - w.start);
      return { allowed: false, retryAfterSec: Math.ceil(remainMs / 1000) };
    }
    w.count++;
    try { localStorage.setItem(K, JSON.stringify(w)); } catch(e) {}
    return { allowed: true };
  }

  return { check };
})();

// ── Input Sanitizer ──────────────────────────────────────────
const Sanitizer = (function() {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function stripScripts(str) {
    // Remove potential script injection
    return String(str)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  function sanitizeInput(str, maxLen) {
    return escapeHtml(stripScripts(String(str || ''))).slice(0, maxLen || 4000);
  }
  function sanitizeUsername(str) {
    return String(str || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 30);
  }
  return { escapeHtml, sanitizeInput, sanitizeUsername, stripScripts };
})();

// ── Session Manager ───────────────────────────────────────────
const SessionManager = (function() {
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const K_ACTIVE = 'rbl_session_active_ts';
  let _warningShown = false;
  let _logoutTimer  = null;

  function touch() {
    try { localStorage.setItem(K_ACTIVE, Date.now()); } catch(e) {}
    _warningShown = false;
    resetTimer();
  }

  function resetTimer() {
    clearTimeout(_logoutTimer);
    _logoutTimer = setTimeout(() => {
      const cu = Analytics.getCurrentUser();
      if (!cu) return;
      if (!_warningShown) {
        _warningShown = true;
        showSessionWarning();
        _logoutTimer = setTimeout(() => forceLogout(), 2 * 60 * 1000);
      }
    }, SESSION_TIMEOUT - 2 * 60 * 1000);
  }

  function showSessionWarning() {
    let toast = document.getElementById('sessionWarningToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sessionWarningToast';
      toast.className = 'session-toast';
      toast.innerHTML = '<i class="fas fa-clock"></i> Session expiring in 2 minutes. Click anywhere to stay logged in.';
      document.body.appendChild(toast);
    }
    toast.classList.add('show');
    document.addEventListener('click', touch, { once: true });
    setTimeout(() => toast.classList.remove('show'), 8000);
  }

  function forceLogout() {
    const cu = Analytics.getCurrentUser();
    if (!cu) return;
    try { localStorage.removeItem('rbl_current_user'); } catch(e) {}
    Analytics.addLog('info', 'Session expired: auto-logout');
    const chatModal = document.getElementById('chatModal');
    if (chatModal) chatModal.classList.remove('show');
    document.body.style.overflow = '';
    // Show a brief message
    const toast = document.getElementById('sessionWarningToast');
    if (toast) { toast.innerHTML = '<i class="fas fa-sign-out-alt"></i> Session expired. Please log in again.'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 4000); }
  }

  function isExpired() {
    try {
      const ts = Number(localStorage.getItem(K_ACTIVE) || 0);
      return ts && (Date.now() - ts > SESSION_TIMEOUT);
    } catch(e) { return false; }
  }

  return { touch, resetTimer, isExpired };
})();

// GPT-5 only — no Claude/Anthropic agents

// ── Chat Conversation History (memory fix) ──
// Per-user conversation history store karta hai
const ChatHistory = (function() {
  const MAX_HISTORY = 20; // Max message pairs yaad rakhega

  function getKey(userEmail) {
    return 'rbl_chat_history_' + (userEmail || 'guest');
  }

  function get(userEmail) {
    try {
      return JSON.parse(localStorage.getItem(getKey(userEmail))) || [];
    } catch(e) { return []; }
  }

  function save(userEmail, history) {
    try {
      // Max history limit rakho
      if (history.length > MAX_HISTORY * 2) {
        history = history.slice(-MAX_HISTORY * 2);
      }
      localStorage.setItem(getKey(userEmail), JSON.stringify(history));
    } catch(e) {}
  }

  function add(userEmail, role, content) {
    const history = get(userEmail);
    history.push({ role, content });
    save(userEmail, history);
    return history;
  }

  function clear(userEmail) {
    localStorage.removeItem(getKey(userEmail));
  }

  function getForApi(userEmail) {
    // Anthropic API ke liye format
    return get(userEmail);
  }

  return { get, save, add, clear, getForApi };
})();

// ─────────────────────────────────────────────────────────────
//  EMAILJS CONFIG
//  Steps:
//   1. emailjs.com pe free account banao
//   2. Gmail service connect karo  → SERVICE_ID yahan daalo
//   3. Template banao with variables: {{otp}}, {{to_email}}, {{to_name}}
//      → TEMPLATE_ID yahan daalo
//   4. Account > API Keys se PUBLIC KEY copy karo
// ─────────────────────────────────────────────────────────────
const EMAILJS_CONFIG = {
  SERVICE_ID  : 'service_e9bgcfc', 
  TEMPLATE_ID : 'template_hkeeeoc',
  PUBLIC_KEY  : 'WJPN774FeTnl3KAcH',
};

// ============================================================
//  ANALYTICS + STORAGE
// ============================================================
const Analytics = (function() {
  const K = {
    totalMessages : 'rbl_total_msgs',
    totalSessions : 'rbl_total_sessions',
    sessionStart  : 'rbl_session_start',
    lastSeen      : 'rbl_last_seen',
    msgLog        : 'rbl_msg_log',
    apiLog        : 'rbl_api_log',
    sysLog        : 'rbl_sys_log',
    dailyMsgs     : 'rbl_daily_msgs',
    browserInfo   : 'rbl_browser',
    apiKeys       : 'rbl_api_keys_v2',
    users         : 'rbl_users_v3',   // v3 — email added
    adminPass     : 'rbl_admin_pass',
    currentUser   : 'rbl_current_user',
  };

  const g = k => { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } };
  const s = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };
  const n = (k,d) => Number(g(k)) || d || 0;

  function initSession() {
    const now = Date.now();
    if (!g(K.sessionStart)) {
      s(K.sessionStart, now);
      s(K.totalSessions, n(K.totalSessions) + 1);
      addLog('info', 'New session started.');
    }
    s(K.lastSeen, now);
    if (!g(K.browserInfo)) {
      s(K.browserInfo, {
        ua        : navigator.userAgent.slice(0, 100),
        lang      : navigator.language,
        platform  : navigator.platform || 'Unknown',
        online    : navigator.onLine,
        tz        : Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen    : screen.width + 'x' + screen.height,
        firstVisit: new Date().toISOString(),
        referrer  : document.referrer || 'Direct',
      });
    }
    setInterval(() => s(K.lastSeen, Date.now()), 10000);
  }

  function trackMessage(type, responseMs) {
    s(K.totalMessages, n(K.totalMessages) + 1);
    const today = new Date().toISOString().slice(0,10);
    const daily = g(K.dailyMsgs) || {};
    daily[today] = (daily[today] || 0) + 1;
    s(K.dailyMsgs, daily);
    const log = g(K.msgLog) || [];
    log.push({ ts: Date.now(), type, ms: responseMs || 0 });
    if (log.length > 100) log.splice(0, log.length - 100);
    s(K.msgLog, log);
  }

  function trackApiCall(ms, ok) {
    const log = g(K.apiLog) || [];
    log.push({ ts: Date.now(), ms, ok });
    if (log.length > 60) log.splice(0, log.length - 60);
    s(K.apiLog, log);
  }

  function addLog(level, msg) {
    const log = g(K.sysLog) || [];
    log.push({ ts: Date.now(), level: level || 'info', msg });
    if (log.length > 120) log.splice(0, log.length - 120);
    s(K.sysLog, log);
  }

  function getStats() {
    const daily  = g(K.dailyMsgs) || {};
    const apiLog = g(K.apiLog)    || [];
    const avgMs  = apiLog.length ? Math.round(apiLog.reduce((a,b)=>a+b.ms,0)/apiLog.length) : 0;
    const successRate = apiLog.length ? Math.round((apiLog.filter(a=>a.ok).length/apiLog.length)*100) : 100;
    const last7 = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().slice(0,10);
      last7.push({ date:key, count:daily[key]||0, label:d.toLocaleDateString('en-IN',{weekday:'short'}) });
    }
    return { totalMessages:n(K.totalMessages), totalSessions:n(K.totalSessions), avgResponseMs:avgMs, successRate, last7, apiLog, msgLog:g(K.msgLog)||[], browser:g(K.browserInfo)||{}, sessionStart:g(K.sessionStart), lastSeen:g(K.lastSeen) };
  }

  // ── Registered Users ──
  function getUsers()   { return g(K.users) || _defUsers(); }
  function saveUsers(u) { s(K.users, u); }

  function registerUser(name, email, password) {
    const users = getUsers();
    const ip    = '—';
    const existing = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      existing.lastLogin = new Date().toISOString();
      existing.loginCount = (existing.loginCount || 0) + 1;
      if (password && !existing.password) existing.password = password;
      saveUsers(users);
      s(K.currentUser, existing);
      addLog('info', `Returning user login: ${existing.name} (${email})`);
      return existing;
    }
    const newUser = {
      id        : Date.now(),
      name,
      email,
      password  : password || '',
      ip,
      role      : 'User',
      status    : 'active',
      joined    : new Date().toISOString().slice(0,10),
      messages  : 0,
      device    : getDeviceType(),
      lastLogin : new Date().toISOString(),
      loginCount: 1,
    };
    users.push(newUser);
    saveUsers(users);
    s(K.currentUser, newUser);
    addLog('info', `New user registered: ${name} (${email}) — ${getDeviceType()}`);
    return newUser;
  }

  function getCurrentUser() { return g(K.currentUser); }

  function incrementUserMessages(email) {
    const users = getUsers();
    const u = users.find(x => x.email && x.email.toLowerCase() === email.toLowerCase());
    if (u) { u.messages = (u.messages||0)+1; saveUsers(users); }
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet';
    if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  function _defUsers() {
    const u = [{ id:1, name:'Rebel Bhaiya', email:'admin@rebel.ai', ip:'127.0.0.1', role:'Admin', status:'active', joined:'2024-01-01', messages:0, device:'Desktop', lastLogin:new Date().toISOString(), loginCount:1 }];
    s(K.users, u); return u;
  }

  // ── API Keys ──
  function getApiKeys()    { return g(K.apiKeys) || _defKeys(); }
  function saveApiKeys(k)  { s(K.apiKeys, k); }
  function getAdminPass()  { return g(K.adminPass) || 'rebel@admin123'; }
  function setAdminPass(p) { s(K.adminPass, p); }
  function getLogs()       { return g(K.sysLog) || []; }

  function _defKeys() {
    const k = [
      { id:1, name:'Primary GPT-5', key:'rbx-'+rndKey(), perms:'Read, Write', usage:0, limit:5000, status:'active',   created:'2024-01-01' },
      { id:2, name:'Image API Key', key:'rbx-'+rndKey(), perms:'Read Only',   usage:0, limit:2000, status:'active',   created:'2024-03-10' },
      { id:3, name:'Dev Test Key',  key:'rbx-'+rndKey(), perms:'Read, Write', usage:0, limit:500,  status:'inactive', created:'2024-07-15' },
    ];
    s(K.apiKeys, k); return k;
  }

  function rndKey() {
    return Math.random().toString(36).slice(2,10).toUpperCase() + Math.random().toString(36).slice(2,10).toUpperCase();
  }

  return { initSession, trackMessage, trackApiCall, addLog, getStats, getUsers, saveUsers, registerUser, getCurrentUser, incrementUserMessages, getApiKeys, saveApiKeys, getAdminPass, setAdminPass, getLogs, rndKey };
})();


// ============================================================
//  OTP ENGINE
// ============================================================
const OTPEngine = (function() {
  let _otp   = '';
  let _email = '';
  let _timer = null;

  function generate() {
    _otp = String(Math.floor(100000 + Math.random() * 900000));
    return _otp;
  }

  function getOtp()   { return _otp; }
  function getEmail() { return _email; }
  function setEmail(e){ _email = e; }
  function clear()    { _otp=''; _email=''; clearInterval(_timer); }

  // EmailJS se real OTP email bhejo
  async function sendOTP(email) {
    const otp = generate();
    _email    = email;

    // Dev mode check — never expose OTP in console in production
    if (EMAILJS_CONFIG.PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
      Analytics.addLog('warn', `[DEV MODE] OTP send attempted for ${email} — EmailJS not configured`);
      return { success: true, devMode: true, otp };
    }

    try {
      emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
      await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, {
        to_email : email,
        otp      : otp,
        to_name  : email.split('@')[0],
        app_name : 'Rebel Gpt',
        expire   : '10 minutes',
      });
      Analytics.addLog('info', `OTP sent to ${email}`);
      return { success: true, devMode: false };
    } catch(err) {
      Analytics.addLog('error', `OTP email failed for ${email}: ${JSON.stringify(err)}`);
      return { success: false, error: err };
    }
  }

  function verify(inputOtp) {
    return inputOtp.trim() === _otp.trim() && _otp !== '';
  }

  return { sendOTP, verify, getOtp, getEmail, setEmail, clear };
})();


// ============================================================
//  AUTH FLOW UI
// ============================================================
let selectedImageBase64 = null;

document.addEventListener('DOMContentLoaded', function () {
  Analytics.initSession();

  // EmailJS init (agar configured hai)
  if (EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' && EMAILJS_CONFIG.PUBLIC_KEY) {
    try { emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY); } catch(e) {}
  }

  // Keep session active on user interaction
  ['click','keydown','touchstart'].forEach(evt => {
    document.addEventListener(evt, () => {
      if (Analytics.getCurrentUser()) SessionManager.touch();
    }, { passive: true });
  });

  // ── Scroll animations ──
  const observer = new IntersectionObserver((entries,obs) => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('fade-in'); obs.unobserve(e.target); } });
  }, { threshold:0.15 });
  document.querySelectorAll('.animate').forEach(el => observer.observe(el));

  // ── Smooth scroll ──
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      const t = document.querySelector(this.getAttribute('href'));
      if(t) window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 80, behavior:'smooth' });
    });
  });

  // ── Navbar ──
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => header && header.classList.toggle('scrolled', window.pageYOffset > 50), { passive:true });
  const tBtn = document.querySelector('.telegram-btn');
  if(tBtn) tBtn.classList.add('pulse-animation');

  // ── About Dev Modal ──
  const aboutBtn = document.getElementById('aboutDevBtn');
  const devModal = document.getElementById('devModal');
  const closeBtn = document.querySelector('.close-modal');
  if(aboutBtn && devModal && closeBtn){
    const open  = ()=>{ devModal.classList.add('show');    document.body.style.overflow='hidden'; };
    const close = ()=>{ devModal.classList.remove('show'); document.body.style.overflow=''; };
    aboutBtn.addEventListener('click', e=>{ e.preventDefault(); open(); });
    closeBtn.addEventListener('click', close);
    window.addEventListener('click', e=>{ if(e.target===devModal) close(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && devModal.classList.contains('show')) close(); });
  }

  // ── Access Rebel Ai Modal ──────────────────────────────────
  const accessRebelBtn   = document.getElementById('accessRebelBtn');
  const accessRebelModal = document.getElementById('accessRebelModal');
  const closeAccessModal = document.getElementById('closeAccessModal');
  const accessChatBtn    = document.getElementById('accessChatBtn');
  const accessVoiceBtn   = document.getElementById('accessVoiceBtn');

  // Pending action: what to open after auth ('chat' or 'voice')
  let pendingAccessAction = 'chat';

  function openAccessRebelModal() {
    if (accessRebelModal) { accessRebelModal.classList.add('show'); document.body.style.overflow='hidden'; }
  }
  function closeAccessRebelModal() {
    if (accessRebelModal) { accessRebelModal.classList.remove('show'); document.body.style.overflow=''; }
  }

  if (accessRebelBtn) {
    accessRebelBtn.addEventListener('click', e => {
      e.preventDefault();
      pendingAccessAction = 'picker';
      const cu = Analytics.getCurrentUser();
      if (cu && cu.name && cu.password) {
        openAccessRebelModal(); // Already logged in
      } else {
        openAuthModal(); // Login pehle
      }
    });
  }
  if (closeAccessModal) {
    closeAccessModal.addEventListener('click', closeAccessRebelModal);
  }
  window.addEventListener('click', e => { if (e.target === accessRebelModal) closeAccessRebelModal(); });

  if (accessChatBtn) {
    accessChatBtn.addEventListener('click', () => {
      pendingAccessAction = 'chat';
      closeAccessRebelModal();
      const cu = Analytics.getCurrentUser();
      if (cu && cu.name) { openChatForUser(cu); } else { openAuthModal(); }
    });
  }

  if (accessVoiceBtn) {
    accessVoiceBtn.addEventListener('click', () => {
      pendingAccessAction = 'voice';
      closeAccessRebelModal();
      const cu = Analytics.getCurrentUser();
      if (cu && cu.name) { openVoiceAssistant(); } else { openAuthModal(); }
    });
  }

  function openVoiceAssistant() {
    const vaModal = document.getElementById('voiceAvatarModal');
    if (vaModal) { vaModal.classList.add('show'); document.body.style.overflow='hidden'; }
  }

  // ────────────────────────────────────────────────────────
  //  CHAT BUTTON → AUTH FLOW
  // ────────────────────────────────────────────────────────
  const chatGptBtn = document.getElementById('chatGptBtn');
  const authModal  = document.getElementById('authModal');
  const chatModal  = document.getElementById('chatModal');

  // chatGptBtn now handled via accessChatBtn in Access Rebel modal
  // Keeping reference for backward compat
  if(chatGptBtn && authModal){
    chatGptBtn.addEventListener('click', e => {
      e.preventDefault();
      const cu = Analytics.getCurrentUser();
      if(cu && cu.email && cu.password) { openChatForUser(cu); return; }
      openAuthModal();
    });
  }

  // ══════════════════════════════════════════════════════════
  //  AUTH MODAL — New 4-Step Flow
  // ══════════════════════════════════════════════════════════

  // Step switcher — sirf ek step visible hoga ek time pe
  function showAuthStep(step) {
    ['authStepLogin','authStepEmail','authStepOtp','authStepCreate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const t = document.getElementById(step);
    if (t) t.style.display = 'flex';
  }

  function openAuthModal() {
    authModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    // Reset all fields
    ['loginUsername','loginPassword','authEmail','authName','authPassword','authConfirmPassword'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.value = '';
    });
    ['loginErr','emailErr','otpErr','nameErr'].forEach(id => showErr(id,''));
    showAuthStep('authStepLogin');
    Analytics.addLog('info', 'Auth modal opened.');
    setTimeout(()=> document.getElementById('loginUsername')?.focus(), 200);
  }

  // Close
  document.getElementById('closeAuthModal')?.addEventListener('click', ()=>{
    authModal.classList.remove('show');
    document.body.style.overflow = '';
    OTPEngine.clear();
  });

  // ── STEP: LOGIN ────────────────────────────────────────────
  // ── Login brute-force tracker ────────────────────────────────
  const _loginAttempts = (function() {
    const K_A = 'rbl_login_attempts', K_L = 'rbl_login_lockout';
    const MAX = 5, LOCK_MS = 10 * 60 * 1000;
    const isLocked = () => { try { return Date.now() < Number(localStorage.getItem(K_L)||0); } catch(e){ return false; } };
    const getLockMins = () => { try { return Math.max(0,Math.ceil((Number(localStorage.getItem(K_L)||0)-Date.now())/60000)); } catch(e){ return 0; } };
    const fail = () => { try { let a=Number(localStorage.getItem(K_A)||0)+1; localStorage.setItem(K_A,a); if(a>=MAX){localStorage.setItem(K_L,Date.now()+LOCK_MS);localStorage.setItem(K_A,0);} } catch(e){} };
    const reset = () => { try{localStorage.removeItem(K_A);localStorage.removeItem(K_L);}catch(e){} };
    const remaining = () => { try{return MAX-Number(localStorage.getItem(K_A)||0);}catch(e){return MAX;} };
    return { isLocked, getLockMins, fail, reset, remaining };
  })();

  function doLogin() {
    if (_loginAttempts.isLocked()) {
      showErr('loginErr', `Too many attempts. Try again in ${_loginAttempts.getLockMins()} min.`);
      return;
    }

    const username = Sanitizer.sanitizeUsername(document.getElementById('loginUsername')?.value || '');
    const password = (document.getElementById('loginPassword')?.value || '').trim();
    showErr('loginErr', '');

    if (!username) { showErr('loginErr', 'Please enter your username.'); return; }
    if (!password) { showErr('loginErr', 'Please enter your password.'); return; }
    if (password.length > 128) { showErr('loginErr', 'Invalid password.'); return; }

    // Find user by username (case-insensitive)
    const users = Analytics.getUsers();
    const user  = users.find(u => u.name && u.name.toLowerCase() === username.toLowerCase());

    if (!user) {
      _loginAttempts.fail();
      showErr('loginErr', 'Username not found. Please create an account first.');
      return;
    }
    if (!user.password || user.password !== password) {
      _loginAttempts.fail();
      const rem = _loginAttempts.remaining();
      showErr('loginErr', rem > 0 ? `Wrong password. ${rem} attempts left.` : 'Account locked for 10 minutes.');
      const passEl = document.getElementById('loginPassword');
      if (passEl) { passEl.style.borderColor='#e74c3c'; setTimeout(()=>{ passEl.style.borderColor=''; passEl.value=''; },600); }
      Analytics.addLog('warn', `Failed login: ${username}`);
      return;
    }

    // ✅ Login success
    _loginAttempts.reset();
    user.lastLogin  = new Date().toISOString();
    user.loginCount = (user.loginCount || 0) + 1;
    Analytics.saveUsers(users);
    localStorage.setItem('rbl_current_user', JSON.stringify(user));
    authModal.classList.remove('show');
    document.body.style.overflow = '';
    OTPEngine.clear();
    Analytics.addLog('info', `Logged in: ${user.name}`);

    if (pendingAccessAction === 'voice') {
      openVoiceAssistant();
    } else if (pendingAccessAction === 'picker') {
      openAccessRebelModal();
    } else {
      openChatForUser(user);
    }
  }

  document.getElementById('loginBtn')?.addEventListener('click', doLogin);
  document.getElementById('loginUsername')?.addEventListener('keypress', e=>{ if(e.key==='Enter') document.getElementById('loginPassword')?.focus(); });
  document.getElementById('loginPassword')?.addEventListener('keypress', e=>{ if(e.key==='Enter') doLogin(); });

  // → Go to Register
  document.getElementById('goToRegisterBtn')?.addEventListener('click', ()=>{
    showErr('emailErr','');
    const el = document.getElementById('authEmail'); if(el) el.value='';
    showAuthStep('authStepEmail');
    setTimeout(()=> document.getElementById('authEmail')?.focus(), 200);
  });

  // ── STEP: ENTER EMAIL FOR OTP ──────────────────────────────
  document.getElementById('backToLoginFromEmail')?.addEventListener('click', ()=>{
    OTPEngine.clear();
    showAuthStep('authStepLogin');
  });

  document.getElementById('sendOtpBtn')?.addEventListener('click', async () => {
    const email = (document.getElementById('authEmail')?.value || '').trim().toLowerCase().slice(0, 254);
    showErr('emailErr','');
    if (!isValidEmail(email)) { showErr('emailErr', 'Enter a valid email address.'); return; }
    if (email.length > 254) { showErr('emailErr', 'Email too long.'); return; }
    setLoading('sendOtpBtn', true);
    const result = await OTPEngine.sendOTP(email);
    setLoading('sendOtpBtn', false);
    if (result.success) {
      const el = document.getElementById('otpSentTo');
      if (el) el.textContent = `OTP sent to ${email}`;
      // Clear OTP boxes
      document.querySelectorAll('.otp-box').forEach(b => b.value = '');
      showErr('otpErr','');
      showAuthStep('authStepOtp');
      startResendTimer(60);
      if (result.devMode) showDevOtpToast(result.otp);
      setTimeout(()=> document.querySelectorAll('.otp-box')[0]?.focus(), 200);
    } else {
      showErr('emailErr', 'Failed to send OTP. Try again.');
    }
  });
  document.getElementById('authEmail')?.addEventListener('keypress', e=>{ if(e.key==='Enter') document.getElementById('sendOtpBtn')?.click(); });

  // ── STEP: OTP VERIFY ───────────────────────────────────────
  let _otpAttempts = 0;
  const otpBoxes = document.querySelectorAll('.otp-box');

  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g,'').slice(-1);
      if (this.value && idx < otpBoxes.length-1) otpBoxes[idx+1].focus();
      if ([...otpBoxes].every(b=>b.value)) document.getElementById('verifyOtpBtn')?.click();
    });
    box.addEventListener('keydown', function(e){
      if (e.key==='Backspace' && !this.value && idx>0) otpBoxes[idx-1].focus();
    });
    box.addEventListener('paste', function(e){
      e.preventDefault();
      const paste = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'');
      otpBoxes.forEach((b,i)=>{ b.value=paste[i]||''; });
      if (paste.length>=6) document.getElementById('verifyOtpBtn')?.click();
    });
  });

  document.getElementById('verifyOtpBtn')?.addEventListener('click', ()=>{
    const entered = [...otpBoxes].map(b=>b.value).join('');
    if (entered.length < 6) { showErr('otpErr','Enter all 6 digits.'); return; }

    _otpAttempts++;
    if (_otpAttempts > 5) {
      showErr('otpErr','Too many wrong attempts. Please restart.');
      setTimeout(()=>{ showAuthStep('authStepEmail'); OTPEngine.clear(); _otpAttempts=0; }, 2000);
      return;
    }

    if (OTPEngine.verify(entered)) {
      _otpAttempts = 0;
      showErr('otpErr','');
      // Clear create-account fields
      ['authName','authPassword','authConfirmPassword'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
      showErr('nameErr','');
      showAuthStep('authStepCreate');
      setTimeout(()=> document.getElementById('authName')?.focus(), 200);
    } else {
      showErr('otpErr','Incorrect OTP. Try again.');
      otpBoxes.forEach(b=>b.classList.add('otp-shake'));
      setTimeout(()=> otpBoxes.forEach(b=>{ b.classList.remove('otp-shake'); b.value=''; }), 600);
      otpBoxes[0].focus();
    }
  });

  document.getElementById('backToEmail')?.addEventListener('click', ()=>{ OTPEngine.clear(); _otpAttempts=0; showAuthStep('authStepEmail'); });

  document.getElementById('resendOtpBtn')?.addEventListener('click', async ()=>{
    const email = OTPEngine.getEmail();
    if (!email) { showAuthStep('authStepEmail'); return; }
    const result = await OTPEngine.sendOTP(email);
    if (result.success) {
      _otpAttempts=0;
      startResendTimer(60);
      otpBoxes.forEach(b=>b.value='');
      otpBoxes[0].focus();
      showErr('otpErr','✓ New OTP sent!');
      setTimeout(()=>showErr('otpErr',''), 3000);
      if (result.devMode) showDevOtpToast(result.otp);
    } else {
      showErr('otpErr','Resend failed. Try again.');
    }
  });

  // ── STEP: CREATE ACCOUNT ───────────────────────────────────
  document.getElementById('startChatBtn')?.addEventListener('click', ()=>{
    const name = Sanitizer.sanitizeUsername(document.getElementById('authName')?.value || '');
    const pass = (document.getElementById('authPassword')?.value || '').trim();
    const conf = (document.getElementById('authConfirmPassword')?.value || '').trim();
    showErr('nameErr','');

    if (!name || name.length < 2) { showErr('nameErr','Username must be at least 2 characters.'); return; }
    if (name.length > 30)          { showErr('nameErr','Username too long (max 30 chars).'); return; }
    if (!pass || pass.length < 6)  { showErr('nameErr','Password must be at least 6 characters.'); return; }
    if (pass.length > 128)         { showErr('nameErr','Password too long.'); return; }
    if (pass !== conf)             { showErr('nameErr','Passwords do not match.'); const c=document.getElementById('authConfirmPassword'); if(c){c.value='';c.focus();} return; }

    // Username already taken?
    if (Analytics.getUsers().find(u => u.name && u.name.toLowerCase()===name.toLowerCase())) {
      showErr('nameErr','Username already taken. Choose another.'); return;
    }

    const email = OTPEngine.getEmail();
    Analytics.registerUser(name, email, pass);
    fetch('/api/users/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password:pass,device:/mobile|android|iphone/i.test(navigator.userAgent)?'Mobile':'Desktop'})}).catch(()=>{});
    OTPEngine.clear();
    Analytics.addLog('info', `Account created: ${name}`);

    // ✅ Go back to Login — pre-fill username — show success hint
    showErr('loginErr','');
    const lun = document.getElementById('loginUsername'); if(lun) lun.value = name;
    const lp  = document.getElementById('loginPassword'); if(lp)  { lp.value=''; }
    const sub = document.getElementById('loginSubtitle');
    if (sub) { sub.textContent = '✓ Account created! Login with your credentials.'; sub.style.color='#2ecc71'; setTimeout(()=>{ sub.textContent='Sign in to continue'; sub.style.color=''; },5000); }
    showAuthStep('authStepLogin');
    setTimeout(()=> document.getElementById('loginPassword')?.focus(), 200);
  });

  document.getElementById('authName')?.addEventListener('keypress', e=>{ if(e.key==='Enter') document.getElementById('authPassword')?.focus(); });
  document.getElementById('authPassword')?.addEventListener('keypress', e=>{ if(e.key==='Enter') document.getElementById('authConfirmPassword')?.focus(); });
  document.getElementById('authConfirmPassword')?.addEventListener('keypress', e=>{ if(e.key==='Enter') document.getElementById('startChatBtn')?.click(); });

  // ────────────────────────────────────────────────────────
  //  OPEN CHAT FOR LOGGED IN USER
  // ────────────────────────────────────────────────────────
  function openChatForUser(user) {
    document.body.style.overflow = 'hidden';
    chatModal.classList.add('show');
    SessionManager.touch();

    // Update chat header
    const avatarEl = document.getElementById('chatUserAvatar');
    const nameEl   = document.getElementById('chatHeaderName');
    if(avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    if(nameEl)   nameEl.textContent   = user.name;

    // Welcome / restore chat
    const chatMessagesEl = document.getElementById('chatMessages');
    if(chatMessagesEl) {
      chatMessagesEl.innerHTML = '';
      const existingHistory = ChatHistory.get(user.email || 'guest');
      if(existingHistory.length > 0) {
        // Restore last 10 messages from history for context
        const toShow = existingHistory.slice(-10);
        toShow.forEach(m => {
          addMessage(m.content, m.role === 'user' ? 'user' : 'bot');
        });
        // Small welcome back strip
        addMessage(`Welcome back, **${Sanitizer.escapeHtml(user.name)}**! Continuing where we left off.`, 'bot');
      } else {
        // Show suggested prompts for new users
        const promptsContainer = buildSuggestedPrompts();
        chatMessagesEl.appendChild(promptsContainer);
      }
    }

    Analytics.addLog('info', `Chat opened by: ${user.name} (${user.email})`);
    setTimeout(()=>document.getElementById('chatInput')?.focus(), 300);
  }

  // Close chat
  const closeChatBtn = document.querySelector('.close-chat');
  if(closeChatBtn && chatModal){
    const closeChat = ()=>{ chatModal.classList.remove('show'); document.body.style.overflow=''; };
    closeChatBtn.addEventListener('click', closeChat);
    window.addEventListener('click', e=>{ if(e.target===chatModal) closeChat(); });
  }

  // ────────────────────────────────────────────────────────
  //  IMAGE UPLOAD
  // ────────────────────────────────────────────────────────
  const imageInput            = document.getElementById('imageInput');
  const uploadBtn             = document.getElementById('uploadBtn');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreviewEl        = document.getElementById('imagePreview');
  const removeImageBtn        = document.getElementById('removeImageBtn');

  if(uploadBtn && imageInput){
    uploadBtn.addEventListener('click', ()=>imageInput.click());
    imageInput.addEventListener('change', function(){
      const file = this.files[0];
      if(file){
        const reader = new FileReader();
        reader.onload = e=>{
          selectedImageBase64 = e.target.result;
          if(imagePreviewEl)        imagePreviewEl.src = e.target.result;
          if(imagePreviewContainer) imagePreviewContainer.style.display='block';
          uploadBtn.style.background  = 'rgba(0,206,209,0.2)';
          uploadBtn.style.borderColor = '#00ced1';
          uploadBtn.style.color       = '#00ced1';
          Analytics.addLog('info',`User uploaded image: ${file.name} (${Math.round(file.size/1024)} KB)`);
        };
        reader.readAsDataURL(file);
      }
    });
    if(removeImageBtn){
      removeImageBtn.addEventListener('click',()=>{
        selectedImageBase64=null; imageInput.value='';
        if(imagePreviewContainer) imagePreviewContainer.style.display='none';
        uploadBtn.style.background=uploadBtn.style.borderColor=uploadBtn.style.color='';
      });
    }
  }

  // ────────────────────────────────────────────────────────
  //  SEND MESSAGE
  // ────────────────────────────────────────────────────────
  const chatInput    = document.getElementById('chatInput');
  const sendBtn      = document.getElementById('sendMessageBtn');
  const chatMessages = document.getElementById('chatMessages');

  // ── Markdown renderer (lightweight, no deps) ────────────────
  function renderMarkdown(text) {
    // Escape raw HTML first to prevent XSS
    let s = Sanitizer.escapeHtml(text);

    // Code blocks (``` ... ```)
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const l = lang || 'code';
      const escaped = code.trim();
      return `<pre><span class="code-lang-label">${Sanitizer.escapeHtml(l)}</span><button class="code-copy-btn" onclick="copyCodeBlock(this)"><i class="fas fa-copy"></i> Copy</button><code>${escaped}</code></pre>`;
    });

    // Inline code
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Headers
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

    // Bold & italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g,         '<em>$1</em>');

    // Blockquote
    s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    s = s.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');

    // Ordered lists
    s = s.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Horizontal rule
    s = s.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:12px 0;">');

    // Links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      (_, txt, url) => `<a href="${Sanitizer.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-teal);">${Sanitizer.escapeHtml(txt)}</a>`);

    // Newlines to <br> (but not inside block elements)
    s = s.replace(/\n{2,}/g, '</p><p>');
    s = s.replace(/\n/g, '<br>');
    s = '<p>' + s + '</p>';

    // Clean up empty paragraphs
    s = s.replace(/<p>\s*<\/p>/g, '');
    s = s.replace(/<p>(<(?:pre|ul|ol|h[123]|blockquote|hr)[^>]*>)/g, '$1');
    s = s.replace(/(<\/(?:pre|ul|ol|h[123]|blockquote)>)<\/p>/g, '$1');

    return s;
  }

  // Global helper for code block copy
  window.copyCodeBlock = function(btn) {
    const code = btn.parentElement.querySelector('code');
    if (!code) return;
    const text = code.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      btn.style.color = '#2ecc71';
      setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; btn.style.color = ''; }, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
    });
  };

  // ── Stop generation controller ───────────────────────────────
  let _abortController = null;
  let _isGenerating = false;

  const stopGenerationBtn = document.getElementById('stopGenerationBtn');
  if (stopGenerationBtn) {
    stopGenerationBtn.addEventListener('click', () => {
      if (_abortController) { _abortController.abort(); }
      _isGenerating = false;
      stopGenerationBtn.style.display = 'none';
    });
  }

  // ── New Chat ──────────────────────────────────────────────────
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      const cu = Analytics.getCurrentUser();
      if (!cu) return;
      if (!confirm('Start a new conversation? Current chat will be cleared.')) return;
      ChatHistory.clear(cu.email || 'guest');
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) {
        chatMessages.innerHTML = '';
        const promptsContainer = buildSuggestedPrompts();
        chatMessages.appendChild(promptsContainer);
      }
      Analytics.addLog('info', `${cu.name} started new chat.`);
    });
  }

  // ── Suggested Prompts builder ─────────────────────────────────
  function buildSuggestedPrompts() {
    const container = document.createElement('div');
    container.id = 'suggestedPromptsContainer';
    container.className = 'suggested-prompts-container';
    const prompts = [
      { icon: 'fa-atom',         text: 'Explain quantum computing in simple terms' },
      { icon: 'fa-code',         text: 'Write a Python function to sort a list' },
      { icon: 'fa-brain',        text: 'What are the latest trends in AI for 2026?' },
      { icon: 'fa-envelope',     text: 'Help me write a professional email' },
      { icon: 'fa-network-wired',text: 'Explain how neural networks work' },
      { icon: 'fa-rocket',       text: 'Give me tips for better productivity' },
    ];
    container.innerHTML = `
      <div class="suggested-prompts-title"><i class="fas fa-robot"></i> How can I help you today?</div>
      <div class="suggested-prompts-grid">
        ${prompts.map(p => `<button class="suggested-prompt-btn" data-prompt="${Sanitizer.escapeHtml(p.text)}"><i class="fas ${p.icon}"></i><span>${Sanitizer.escapeHtml(p.text)}</span></button>`).join('')}
      </div>`;
    container.querySelectorAll('.suggested-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt || '';
        if (chatInput) { chatInput.value = prompt; chatInput.focus(); }
        container.remove();
      });
    });
    return container;
  }

  // Wire up existing suggested prompts in HTML
  document.querySelectorAll('.suggested-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt || '';
      if (chatInput) { chatInput.value = prompt; chatInput.focus(); }
      const container = document.getElementById('suggestedPromptsContainer');
      if (container) container.remove();
    });
  });

  // ── Textarea auto-resize & char counter ──────────────────────
  if (chatInput) {
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 140) + 'px';
      const counter = document.getElementById('charCounter');
      const len = this.value.length;
      if (counter) {
        counter.textContent = `${len} / 4000`;
        counter.style.color = len > 3500 ? '#e74c3c' : len > 3000 ? '#f1c40f' : 'rgba(255,255,255,0.2)';
      }
    });
  }

  // ── API call with model selection ────────────────────────────
  async function callGPT5API(message, imageBase64, historyMessages, systemPrompt, signal) {
    const history = historyMessages || [];
    let contextPrompt = (systemPrompt || AI_CONFIG.system_prompt) + '\n\n';
    if (history.length > 0) {
      contextPrompt += 'CONVERSATION HISTORY (most recent last):\n';
      history.forEach(m => {
        contextPrompt += `${m.role === 'user' ? 'User' : 'Rebel Gpt'}: ${m.content}\n`;
      });
      contextPrompt += '\n';
    }
    contextPrompt += `User: ${message}\nRebel Gpt:`;

    // Get selected model endpoint
    const modelSel = document.getElementById('modelSelector');
    const model    = modelSel ? modelSel.value : 'gpt-5';
    const endpoint = AI_CONFIG.endpoints[model] || AI_CONFIG.baseURL;

    // copilot uses different param name
    const paramName = model === 'copilot' ? 'text' : 'q';
    let url = `${endpoint}?${paramName}=${encodeURIComponent(contextPrompt)}`;
    if (imageBase64 && model !== 'copilot') url += `&image=${encodeURIComponent(imageBase64)}`;

    const fetchOpts = { signal };
    const response = await fetch(url, fetchOpts);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Normalize various response shapes
    const result = data.results || data.result || data.response || data.message || data.content || data.answer;
    if (!result) throw new Error('Invalid API response');
    return String(result);
  }

  async function sendMessage() {
    const rawMessage = chatInput.value.trim();
    if(!rawMessage && !selectedImageBase64) return;

    // Rate limit check
    const rl = RateLimiter.check();
    if (!rl.allowed) {
      addMessage(`⏳ Too many requests. Please wait ${rl.retryAfterSec} seconds.`, 'bot');
      return;
    }

    // Input length guard
    if (rawMessage.length > 4000) {
      addMessage('❌ Message too long. Max 4000 characters.', 'bot');
      return;
    }

    // Session expiry check
    if (SessionManager.isExpired()) {
      addMessage('⚠️ Your session has expired. Please log in again.', 'bot');
      try { localStorage.removeItem('rbl_current_user'); } catch(e) {}
      return;
    }
    SessionManager.touch();

    // Remove suggested prompts if present
    const promptsEl = document.getElementById('suggestedPromptsContainer');
    if (promptsEl) promptsEl.remove();

    const message = rawMessage;
    addMessage(message, 'user', false, selectedImageBase64);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    const counter = document.getElementById('charCounter');
    if (counter) counter.textContent = '0 / 4000';
    sendBtn.disabled = true;

    // Show stop button
    if (stopGenerationBtn) stopGenerationBtn.style.display = 'flex';
    _isGenerating = true;

    const loadingId = addMessage('', 'bot', true);
    const t0 = performance.now();

    // Track api key usage
    const keys = Analytics.getApiKeys();
    if(keys[0] && keys[0].status==='active'){ keys[0].usage=(keys[0].usage||0)+1; Analytics.saveApiKeys(keys); }

    const cu = Analytics.getCurrentUser();
    const userEmail = cu?.email || 'guest';
    Analytics.addLog('info', `${cu?cu.name:'User'}: "${message.slice(0,60)}${message.length>60?'…':''}"`);

    const systemPrompt = localStorage.getItem('rbl_system_prompt') || AI_CONFIG.system_prompt;
    const historyBeforeSend = ChatHistory.get(userEmail);
    ChatHistory.add(userEmail, 'user', message);

    // Abort controller for stop generation
    _abortController = new AbortController();
    const { signal } = _abortController;

    try {
      let replyText = '';
      replyText = await callGPT5API(message, selectedImageBase64, historyBeforeSend, systemPrompt, signal);

      if (!_isGenerating) {
        // User pressed stop — remove loading indicator silently
        document.getElementById(loadingId)?.remove();
        sendBtn.disabled = false;
        return;
      }

      const ms = Math.round(performance.now()-t0);
      ChatHistory.add(userEmail, 'assistant', replyText);

      document.getElementById(loadingId)?.remove();
      addMessage(replyText, 'bot');
      Analytics.trackMessage('text', ms);
      Analytics.trackApiCall(ms, true);
      Analytics.addLog('info', `Rebel Gpt replied in ${ms}ms (~${Math.round(replyText.length/4)} tokens)`);
      if(cu) Analytics.incrementUserMessages(cu.email);
      fetch('/api/track/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_email:cu?.email,type:'text',response_ms:ms})}).catch(()=>{});
      fetch('/api/track/api-call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({response_ms:ms,success:true})}).catch(()=>{});
    } catch(err) {
      if (err.name === 'AbortError') {
        document.getElementById(loadingId)?.remove();
        sendBtn.disabled = false;
        if (stopGenerationBtn) stopGenerationBtn.style.display = 'none';
        return;
      }
      const ms = Math.round(performance.now()-t0);
      const h = ChatHistory.get(userEmail);
      if(h.length && h[h.length-1].role==='user') { h.pop(); ChatHistory.save(userEmail, h); }
      document.getElementById(loadingId)?.remove();
      addMessage(`❌ ${err.message}`, 'bot');
      Analytics.trackApiCall(ms, false);
      Analytics.addLog('error', `API failed (${ms}ms): ${err.message}`);
      fetch('/api/track/api-call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({response_ms:ms,success:false})}).catch(()=>{});
    } finally {
      selectedImageBase64=null;
      _isGenerating = false;
      _abortController = null;
      const pc=document.getElementById('imagePreviewContainer'); if(pc) pc.style.display='none';
      if(uploadBtn){ uploadBtn.style.background=uploadBtn.style.color=uploadBtn.style.borderColor=''; }
      imageInput.value=''; sendBtn.disabled=false;
      if (stopGenerationBtn) stopGenerationBtn.style.display = 'none';
      chatInput.focus();
    }
  }

  if(sendBtn && chatInput){
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', e=>{
      if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
    });
  }

  // ────────────────────────────────────────────────────────
  //  HELPERS
  // ────────────────────────────────────────────────────────
  function addMessage(text, sender, isLoading=false, imageData=null) {
    const container = document.createElement('div');
    container.classList.add('message-container', `${sender}-container`);

    if(sender==='bot'){
      const avatar = document.createElement('img');
      avatar.src='https://public.youware.com/users-website-assets/prod/a6330b2a-2d0c-4263-9e0e-f58a67b39c2d/3bd4f7557c4e4ed0adc20480987490fa.jpg';
      avatar.alt='Rebel AI'; avatar.classList.add('message-avatar');
      container.appendChild(avatar);
    }

    const msgWrapper = document.createElement('div');
    msgWrapper.style.cssText = 'display:flex;flex-direction:column;max-width:100%;';

    const div = document.createElement('div');
    div.classList.add('message', `${sender}-message`);

    if(imageData && sender==='user'){
      const img = document.createElement('img');
      img.src = imageData;
      img.style.cssText = 'max-width:200px;max-height:150px;border-radius:10px;display:block;margin-bottom:8px;border:2px solid rgba(255,255,255,0.2);';
      div.appendChild(img);
    }

    if(isLoading){
      div.id = 'loading-' + Date.now();
      // Show animated typing dots instead of plain text
      div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    } else if(sender === 'bot'){
      // Render markdown with typewriter
      const contentSpan = document.createElement('span');
      div.appendChild(contentSpan);

      // Typewriter effect character by character
      let i = 0;
      let rawAccumulated = '';
      const tw = () => {
        if (!_isGenerating && i < text.length - 1) return; // stopped early
        if(i < text.length){
          rawAccumulated += text.charAt(i++);
          // Re-render markdown periodically for performance
          if(i % 8 === 0 || i === text.length) {
            contentSpan.innerHTML = renderMarkdown(rawAccumulated);
          }
          chatMessages.scrollTop = chatMessages.scrollHeight;
          setTimeout(tw, 12);
        } else {
          // Final render
          contentSpan.innerHTML = renderMarkdown(text);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      };
      tw();
    } else {
      if(text){
        const sp = document.createElement('span');
        sp.textContent = text;
        div.appendChild(sp);
      }
    }

    msgWrapper.appendChild(div);

    // Timestamp
    if(!isLoading) {
      const ts = document.createElement('span');
      ts.className = 'msg-timestamp';
      ts.textContent = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
      msgWrapper.appendChild(ts);

      // Action buttons (copy + regenerate for bot)
      if(sender === 'bot' && text) {
        const actions = document.createElement('div');
        actions.className = 'msg-actions';

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy'; copyBtn.classList.remove('copied'); }, 2000);
          }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch(e) {}
            document.body.removeChild(ta);
          });
        });
        actions.appendChild(copyBtn);

        // Regenerate button (only for bot messages)
        const regenBtn = document.createElement('button');
        regenBtn.className = 'msg-action-btn';
        regenBtn.innerHTML = '<i class="fas fa-redo"></i> Regenerate';
        regenBtn.addEventListener('click', async () => {
          // Find the last user message from history
          const cu = Analytics.getCurrentUser();
          const userEmail = cu?.email || 'guest';
          const history = ChatHistory.get(userEmail);
          // Remove last assistant message and re-send last user message
          let lastUserMsg = '';
          const trimmedHistory = [...history];
          if(trimmedHistory.length && trimmedHistory[trimmedHistory.length-1].role === 'assistant') trimmedHistory.pop();
          if(trimmedHistory.length && trimmedHistory[trimmedHistory.length-1].role === 'user') {
            lastUserMsg = trimmedHistory[trimmedHistory.length-1].content;
            trimmedHistory.pop();
          }
          if(!lastUserMsg) return;
          ChatHistory.save(userEmail, trimmedHistory);
          // Remove this message container from UI
          container.remove();
          // Re-trigger send with the user message
          if(chatInput) { chatInput.value = lastUserMsg; }
          sendMessage();
        });
        actions.appendChild(regenBtn);

        msgWrapper.appendChild(actions);
      }

      // User message: copy only
      if(sender === 'user' && text) {
        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        actions.style.justifyContent = 'flex-end';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy'; copyBtn.classList.remove('copied'); }, 2000);
          }).catch(() => {});
        });
        actions.appendChild(copyBtn);
        msgWrapper.appendChild(actions);
      }
    }

    container.appendChild(msgWrapper);
    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return isLoading ? div.id : null;
  }

  function showStep(n) {
    [1,2,3,'3b'].forEach(i=>{ const el=document.getElementById('authStep'+i); if(el) el.style.display=(i==n)?'flex':'none'; });
  }

  function showErr(id, msg) {
    const el=document.getElementById(id); if(el){ el.textContent=msg; el.style.color=msg.startsWith('✓')?'#2ecc71':'#e74c3c'; }
  }

  function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  function setLoading(btnId, loading) {
    const textEl   = document.getElementById('sendOtpText');
    const loaderEl = document.getElementById('sendOtpLoader');
    const btn      = document.getElementById(btnId);
    if(textEl)   textEl.style.display   = loading ? 'none'  : 'inline';
    if(loaderEl) loaderEl.style.display = loading ? 'inline': 'none';
    if(btn)      btn.disabled = loading;
  }

  let resendCountdown = null;
  function startResendTimer(seconds) {
    const btn   = document.getElementById('resendOtpBtn');
    const timer = document.getElementById('resendTimer');
    if(btn)   btn.disabled = true;
    clearInterval(resendCountdown);
    let s = seconds;
    if(timer) timer.textContent = ` (${s}s)`;
    resendCountdown = setInterval(()=>{
      s--;
      if(timer) timer.textContent = s>0 ? ` (${s}s)` : '';
      if(s<=0){ clearInterval(resendCountdown); if(btn) btn.disabled=false; }
    }, 1000);
  }

  function showDevOtpToast(otp) {
    // In dev mode only — show OTP since EmailJS not configured
    // In production with EmailJS configured, this function is never called
    const toast = document.createElement('div');
    toast.innerHTML = `<i class="fas fa-info-circle"></i> <strong>Dev Mode:</strong> Check browser console for OTP`;
    toast.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(0,206,209,0.4);color:white;padding:14px 24px;border-radius:12px;z-index:99999;font-size:0.9rem;box-shadow:0 10px 30px rgba(0,0,0,0.5);text-align:center;min-width:280px;';
    document.body.appendChild(toast);
    // Only log to console in dev mode (not to UI)
    if (typeof otp !== 'undefined') {
      console.info('%c[DEV] OTP: ' + otp, 'color:#00ced1;font-size:1.2em;font-weight:bold;');
    }
    setTimeout(()=>toast.remove(), 8000);
  }
});


// ============================================================
//  ADMIN PANEL — REAL-TIME DATA (Backend API + WebSocket)
// ============================================================
(function () {
  let pingInterval    = null;
  let clockInterval   = null;
  let refreshInterval = null;
  let pingHistory     = [];
  let currentPingMs   = 0;
  let _cachedKeys     = []; // API keys cache for copy/reveal
  let _adminToken     = sessionStorage.getItem('rbl_admin_token') || null;
  let _ws             = null; // Socket.io instance

  // ── Admin Token helpers ─────────────────────────────────────
  function saveToken(t) { _adminToken = t; sessionStorage.setItem('rbl_admin_token', t); }
  function clearToken()  { _adminToken = null; sessionStorage.removeItem('rbl_admin_token'); }
  function getToken()    { return _adminToken; }

  // ── Generic API helper (auto-injects admin token) ──────────
  async function api(url, opts = {}) {
    try {
      const headers = { ...(opts.headers || {}) };
      if (getToken()) headers['x-admin-token'] = getToken();
      const r = await fetch(url, { ...opts, headers });
      if (r.status === 401) { clearToken(); return { ok: false, error: 'Unauthorized' }; }
      return await r.json();
    } catch (e) {
      console.warn('API error:', url, e.message);
      return { ok: false, error: e.message };
    }
  }

  function post(url, body) {
    return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  function put(url, body) {
    return api(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  }
  function del(url) {
    return api(url, { method: 'DELETE' });
  }

  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function formatDur(ms) { const s = Math.floor(ms / 1000); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'm ' + s % 60 + 's'; return Math.floor(m / 60) + 'h ' + m % 60 + 'm'; }

  // ── PHP Polling (replaces Socket.io — PHP doesn't support WebSocket natively) ──
  let _pollInterval = null;

  function initWebSocket() {
    // PHP backend uses polling instead of Socket.io
    if (_pollInterval) return;
    console.log('📡 PHP mode: Starting stats polling every 3s...');
    _pollInterval = setInterval(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res  = await fetch(BACKEND_URL + '/api/stats/poll', {
          headers: { 'x-admin-token': token }
        });
        const data = await res.json();
        if (data && data.ok) {
          applyStats(data);
          // Refresh active tabs
          if (activeTab === 'users')    renderUsers();
          if (activeTab === 'overview') refreshOverview();
        }
      } catch(e) {
        console.warn('Stats poll error:', e.message);
      }
    }, 3000);
  }

  function disconnectWebSocket() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  }

  // ── Track active tab ─────────────────────────────────────────
  let activeTab = 'overview';

  document.addEventListener('DOMContentLoaded', function () {
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    const adminModal    = document.getElementById('adminModal');
    const adminLogin    = document.getElementById('adminLogin');
    const adminDash     = document.getElementById('adminDashboard');
    const loginBtn      = document.getElementById('adminLoginBtn');
    const passInput     = document.getElementById('adminPasswordInput');
    const loginErr      = document.getElementById('adminLoginErr');
    const closeLogin    = document.getElementById('closeAdminLogin');
    const closeDash     = document.getElementById('closeAdminDashboard');
    const logoutBtn     = document.getElementById('adminLogoutBtn');

    if (!adminPanelBtn) return;

    adminPanelBtn.addEventListener('click', e => {
      e.preventDefault();
      adminModal.classList.add('show'); document.body.style.overflow = 'hidden';
      
      // Check if already logged in (valid token in sessionStorage)
      const isLoggedIn = !!getToken();
      if (isLoggedIn) {
        adminLogin.style.display = 'none';
        adminDash.style.display = 'flex';
        initDashboard();
      } else {
        adminLogin.style.display = 'flex';
        adminDash.style.display = 'none';
        if (loginErr)  loginErr.textContent = '';
        if (passInput) { passInput.value = ''; setTimeout(() => passInput.focus(), 100); }
      }
    });

    function closeAdmin() {
      adminModal.classList.remove('show'); document.body.style.overflow = '';
      clearInterval(pingInterval); clearInterval(clockInterval); clearInterval(refreshInterval);
    }

    if (closeLogin) closeLogin.addEventListener('click', closeAdmin);
    if (closeDash)  closeDash.addEventListener('click',  closeAdmin);
    if (logoutBtn)  logoutBtn.addEventListener('click', () => {
      clearInterval(pingInterval); clearInterval(clockInterval); clearInterval(refreshInterval);
      disconnectWebSocket();
      adminDash.style.display = 'none'; adminLogin.style.display = 'flex';
      localStorage.removeItem('rbl_admin_session');
      clearToken();
      post('/api/auth/logout', {}).catch(() => {});
    });

    // ── Admin Login Brute-Force Protection ──────────────────────────────────
    const _adminAttempts = (function() {
      const K_ATTEMPTS = 'rbl_admin_attempts';
      const K_LOCKOUT  = 'rbl_admin_lockout';
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MS   = 15 * 60 * 1000; // 15 minutes

      function isLocked() {
        try {
          const lockUntil = Number(localStorage.getItem(K_LOCKOUT) || 0);
          return Date.now() < lockUntil;
        } catch(e) { return false; }
      }

      function getLockRemaining() {
        try {
          const lockUntil = Number(localStorage.getItem(K_LOCKOUT) || 0);
          return Math.max(0, Math.ceil((lockUntil - Date.now()) / 60000));
        } catch(e) { return 0; }
      }

      function recordFail() {
        try {
          let attempts = Number(localStorage.getItem(K_ATTEMPTS) || 0) + 1;
          localStorage.setItem(K_ATTEMPTS, attempts);
          if (attempts >= MAX_ATTEMPTS) {
            localStorage.setItem(K_LOCKOUT, Date.now() + LOCKOUT_MS);
            localStorage.setItem(K_ATTEMPTS, 0);
          }
        } catch(e) {}
      }

      function reset() {
        try {
          localStorage.removeItem(K_ATTEMPTS);
          localStorage.removeItem(K_LOCKOUT);
        } catch(e) {}
      }

      function remaining() {
        try { return MAX_ATTEMPTS - Number(localStorage.getItem(K_ATTEMPTS) || 0); } catch(e) { return MAX_ATTEMPTS; }
      }

      return { isLocked, getLockRemaining, recordFail, reset, remaining };
    })();

    // ── Login — verify via backend with fallback ──────────────────────────────
    async function doLogin() {
      // Brute-force lockout check
      if (_adminAttempts.isLocked()) {
        const mins = _adminAttempts.getLockRemaining();
        if (loginErr) { loginErr.textContent = `Too many attempts. Locked for ${mins} min.`; }
        Analytics.addLog('warn', 'Admin login blocked — lockout active.');
        return;
      }

      const pass = passInput ? passInput.value.trim() : '';
      if (!pass) { if (loginErr) loginErr.textContent = 'Enter password.'; return; }

      let isOk = false;

      try {
        const data = await post('/api/auth/verify', { password: pass });
        if (data && data.ok && data.token) {
          saveToken(data.token);
          isOk = true;
        }
      } catch(e) {
        // Backend unreachable — fallback to local password check
        const localPass = Analytics.getAdminPass();
        isOk = !!(localPass && pass === localPass);
      }

      if (isOk) {
        _adminAttempts.reset();
        adminLogin.style.display = 'none'; adminDash.style.display = 'flex';
        localStorage.setItem('rbl_admin_session', 'active');
        try { post('/api/logs/add', { level: 'info', msg: 'Admin logged in.' }); } catch(e) {}
        initDashboard();
      } else {
        _adminAttempts.recordFail();
        const rem = _adminAttempts.remaining();
        const msg = rem > 0 ? `✕ Wrong password! ${rem} attempts left.` : 'Account locked for 15 minutes.';
        if (loginErr) { loginErr.textContent = msg; setTimeout(() => { if (loginErr) loginErr.textContent = ''; }, 3000); }
        if (passInput) { passInput.style.borderColor = '#e74c3c'; setTimeout(() => { passInput.style.borderColor = ''; passInput.value = ''; }, 600); }
        Analytics.addLog('warn', `Failed admin login attempt. Remaining: ${rem}`);
      }
    }

    if (loginBtn)  loginBtn.addEventListener('click', doLogin);
    if (passInput) passInput.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });

    // ── Tab switching ───────────────────────────────────────────
    document.querySelectorAll('.admin-nav-item').forEach(item => {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        const tab = this.dataset.tab;
        activeTab = tab;
        document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        const target = document.getElementById('tab-' + tab); if (target) target.classList.add('active');
        const titles = { overview: 'Dashboard Overview', users: 'User Management', apikeys: 'API Key Management', ping: 'Ping Monitor', logs: 'System Logs', settings: 'Settings & Info' };
        const titleEl = document.getElementById('adminTabTitle'); if (titleEl) titleEl.textContent = titles[tab] || 'Admin';
        clearInterval(pingInterval);
        if (tab === 'ping')     { doPing(); pingInterval = setInterval(doPing, 3500); }
        if (tab === 'logs')     renderLogs();
        if (tab === 'users')    renderUsers();
        if (tab === 'apikeys')  renderApiKeys();
        if (tab === 'overview') refreshOverview();
        if (tab === 'settings') renderBrowserInfo();
      });
    });
  });

  // ── Dashboard init ───────────────────────────────────────────
  function initDashboard() {
    startClock();
    refreshOverview(); renderUsers(); renderApiKeys(); renderLogs();
    setupUserActions(); setupApiKeyActions(); setupSettingsActions();
    doPing(); pingInterval = setInterval(doPing, 3500);
    clearInterval(refreshInterval);
    // Init WebSocket for real-time updates
    initWebSocket();
    // Fallback polling every 10s (WebSocket handles faster updates)
    refreshInterval = setInterval(function () {
      refreshOverview();
      if (activeTab === 'users')    renderUsers();
      if (activeTab === 'apikeys')  renderApiKeys();
      if (activeTab === 'logs')     renderLogs();
      if (activeTab === 'settings') renderBrowserInfo();
    }, 10000);
  }

  function startClock() {
    const el = document.getElementById('adminClock'); clearInterval(clockInterval);
    function tick() { if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false }); }
    tick(); clockInterval = setInterval(tick, 1000);
  }

  // ── OVERVIEW — fetches from /api/stats ───────────────────────
  async function refreshOverview() {
    const data = await api('/api/stats');
    if (!data.ok) return;
    applyStats(data);
  }

  function applyStats(data) {
    const { totalMessages, totalSessions, totalUsers, activeKeys, avgMs, successRate, last7, onlineCount } = data;

    setText('stat-total-users',   totalUsers);
    setText('stat-messages',      Number(totalMessages).toLocaleString('en-IN'));
    setText('stat-api-keys',      activeKeys);
    setText('stat-ping',          currentPingMs ? currentPingMs + ' ms' : '—');
    setText('stat-sessions',      totalSessions);
    setText('stat-avg-ms',        avgMs ? avgMs + ' ms' : '—');
    setText('stat-success',       successRate + '%');
    setText('stat-errors',        '—');
    setText('stat-online-users',  onlineCount != null ? onlineCount : '—');

    const badge = document.getElementById('ping-status-badge');
    if (badge) { badge.textContent = successRate + '% uptime'; badge.style.color = successRate >= 90 ? '#2ecc71' : successRate >= 70 ? '#f1c40f' : '#e74c3c'; }

    const onlineBadge = document.getElementById('stat-online-badge');
    if (onlineBadge) { onlineBadge.textContent = (onlineCount || 0) + ' online'; onlineBadge.style.color = onlineCount > 0 ? '#2ecc71' : 'rgba(255,255,255,0.3)'; }

    buildActivityChart(last7);
    updateSystemStatus({ avgResponseMs: avgMs, successRate });
  }

  function buildActivityChart(last7) {
    const chart = document.getElementById('activityChart'); if (!chart || !last7) return;
    const max = Math.max(...last7.map(d => d.count), 1);
    chart.innerHTML = '';
    last7.forEach((d, i) => {
      const wrap  = document.createElement('div'); wrap.className = 'bar-wrap';
      const count = document.createElement('div'); count.className = 'bar-count'; count.textContent = d.count || '';
      const bar   = document.createElement('div'); bar.className = 'bar'; bar.title = d.date + ': ' + d.count + ' msgs'; bar.style.height = '0px';
      const label = document.createElement('div'); label.className = 'bar-label'; label.textContent = d.label;
      if (i === 6) { bar.style.background = 'linear-gradient(to top,#00ced1,#8a2be2)'; bar.style.boxShadow = '0 0 10px rgba(0,206,209,0.4)'; }
      wrap.appendChild(count); wrap.appendChild(bar); wrap.appendChild(label); chart.appendChild(wrap);
      setTimeout(() => { bar.style.height = Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 5 : 2) + 'px'; }, 80 + i * 55);
    });
  }

  function updateSystemStatus(stats) {
    const avgMs = stats.avgResponseMs || 0;
    const sr    = stats.successRate != null ? stats.successRate : 100;
    const apiOk  = sr >= 70;
    const chatOk = avgMs < 3000 || avgMs === 0;
    setStatus('sys-api-dot',       'sys-api',       apiOk  ? 'green' : 'red',    apiOk  ? 'Online' : 'Degraded');
    setStatus('sys-chat-dot',      'sys-chat',      chatOk ? 'green' : 'yellow', chatOk ? 'Online' : 'Slow');
    setStatus('sys-storage-dot',   'sys-storage',   'green', 'Online');
    setStatus('sys-analytics-dot', 'sys-analytics', 'green', 'Tracking');
    const rtEl = document.getElementById('sys-rt'); if (rtEl) rtEl.textContent = avgMs ? avgMs + ' ms avg' : '—';
  }

  function setStatus(dotId, valId, color, text) {
    const dot = document.getElementById(dotId); if (dot) dot.className = 'status-dot ' + color;
    const val = document.getElementById(valId); if (val) val.textContent = text;
  }

  // ── PING ─────────────────────────────────────────────────────
  function doPing() {
    const t0 = performance.now();
    fetch(AI_CONFIG.baseURL + '?q=_ping_&_t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' })
      .then(() => updatePingUI(Math.round(performance.now() - t0), true))
      .catch(() => updatePingUI(Math.round(performance.now() - t0), false));
  }

  function updatePingUI(ms, ok) {
    currentPingMs = ms; pingHistory.push({ ms, ok, ts: Date.now() });
    if (pingHistory.length > 24) pingHistory.shift();
    let label = 'Excellent', color = '#2ecc71';
    if (!ok || ms > 600) { label = 'Offline'; color = '#e74c3c'; }
    else if (ms > 400)   { label = 'Slow';    color = '#f1c40f'; }
    else if (ms > 150)   { label = 'Good';    color = '#00ced1'; }
    const valEl = document.getElementById('pingValue');
    if (valEl) { valEl.textContent = ms; valEl.style.color = color; }
    setText('stat-ping', ms + ' ms');
    const statEl = document.getElementById('pingStatusText'); if (statEl) { statEl.textContent = label + ' — ' + ms + 'ms'; statEl.style.color = color; }
    const circle = document.getElementById('pingCircle'); if (circle) { circle.style.borderColor = color; circle.style.boxShadow = '0 0 35px ' + color + '44'; }
    const badge  = document.getElementById('ping-status-badge'); if (badge) { badge.textContent = label; badge.style.color = color; }
    const endpoints = [{ id: 1, ms, ok }, { id: 2, ms: Math.round(ms * 0.35 + Math.random() * 15), ok: true }, { id: 3, ms: Math.round(ms * 0.55 + Math.random() * 25), ok: true }, { id: 4, ms: Math.round(ms * 1.4 + Math.random() * 60), ok: ms < 500 }];
    endpoints.forEach(ep => {
      const pe = document.getElementById('ep-ping-' + ep.id); if (pe) pe.textContent = ep.ms + ' ms';
      const be = document.getElementById('ep-badge-' + ep.id);
      if (be) { const c = !ep.ok ? 'red' : ep.ms > 400 ? 'yellow' : 'green'; const t = !ep.ok ? 'Offline' : ep.ms > 400 ? 'Slow' : 'Online'; be.className = 'endpoint-badge ' + c; be.textContent = t; }
    });
    const histChart = document.getElementById('pingHistoryChart');
    if (histChart) {
      const maxH = Math.max(...pingHistory.map(p => p.ms), 1); histChart.innerHTML = '';
      pingHistory.forEach(p => { const bar = document.createElement('div'); bar.className = 'ping-bar'; bar.style.height = Math.round((p.ms / maxH) * 55) + 5 + 'px'; bar.title = p.ms + ' ms'; bar.style.background = !p.ok ? 'rgba(231,76,60,0.7)' : p.ms > 400 ? 'rgba(241,196,15,0.7)' : 'linear-gradient(to top,rgba(0,206,209,0.7),rgba(138,43,226,0.7))'; histChart.appendChild(bar); });
    }
    const upEl = document.getElementById('pingUptime');
    if (upEl && pingHistory.length) { const upt = Math.round((pingHistory.filter(p => p.ok).length / pingHistory.length) * 100); upEl.textContent = upt + '%'; upEl.style.color = upt >= 95 ? '#2ecc71' : upt >= 80 ? '#f1c40f' : '#e74c3c'; }
    const msVals = pingHistory.map(p => p.ms);
    setText('pingMin', Math.min(...msVals) + ' ms'); setText('pingMax', Math.max(...msVals) + ' ms');
    setText('pingAvg', Math.round(msVals.reduce((a, b) => a + b, 0) / msVals.length) + ' ms');
  }

  // ── USERS — fetches from /api/users ──────────────────────────
  async function renderUsers(filter) {
    const data = await api('/api/users');
    if (!data.ok) return;
    let list = data.users;
    if (filter) list = list.filter(u => u.name.toLowerCase().includes(filter) || (u.email || '').toLowerCase().includes(filter));

    const tbody = document.getElementById('usersTableBody'); if (!tbody) return;
    tbody.innerHTML = '';
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:rgba(255,255,255,0.25);padding:30px;">No users found</td></tr>'; return; }

    list.forEach(u => {
      // User is "online" if last_login within past 2 minutes
      const isOnline = u.last_login && (Date.now() - new Date(u.last_login).getTime() < 120000);
      const lastLoginStr = u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:rgba(255,255,255,0.25);font-size:0.78rem;">#${u.id}</td>
        <td>
          <div style="display:flex;align-items:center;gap:9px;">
            <div style="width:33px;height:33px;border-radius:50%;background:linear-gradient(135deg,#8a2be2,#00ced1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">${u.name.charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-weight:600;color:white;font-size:0.88rem;">${u.name}</div>
              <div style="font-size:0.7rem;color:rgba(255,255,255,0.3);">${u.device || 'Unknown'} · ${u.login_count || 1}x login</div>
            </div>
            ${isOnline ? '<span style="width:7px;height:7px;border-radius:50%;background:#2ecc71;box-shadow:0 0 6px #2ecc71;display:inline-block;" title="Online"></span>' : ''}
          </div>
        </td>
        <td style="font-size:0.78rem;color:rgba(255,255,255,0.6);">${u.email || '—'}</td>
        <td style="font-size:0.75rem;color:rgba(255,255,255,0.3);">${u.password ? '••••••' : '<span style=\"color:rgba(255,255,255,0.2)\">not set</span>'}</td>
        <td style="font-family:monospace;font-size:0.75rem;color:rgba(255,255,255,0.35);">${u.ip || '—'}</td>
        <td><span class="user-badge ${u.role.toLowerCase()}">${u.role}</span></td>
        <td><span class="status-badge ${u.status}">${u.status === 'active' ? '● Active' : '○ Inactive'}</span></td>
        <td style="font-size:0.75rem;color:rgba(255,255,255,0.35);">${u.joined}</td>
        <td style="font-weight:600;color:var(--accent-teal);">${(u.messages || 0).toLocaleString('en-IN')}</td>
        <td style="font-size:0.75rem;color:rgba(255,255,255,0.3);">${lastLoginStr}</td>
        <td>
          <button class="table-action-btn" title="Toggle" onclick="adminToggleUser(${u.id})"><i class="fas fa-power-off"></i></button>
          <button class="table-action-btn danger" title="Delete" onclick="adminDeleteUser(${u.id})"><i class="fas fa-trash"></i></button>
        </td>`;
      tbody.appendChild(tr);
    });
    setText('stat-total-users', data.users.length);
  }

  window.adminToggleUser = async function (id) {
    await put('/api/users/' + id + '/toggle');
    renderUsers();
  };
  window.adminDeleteUser = async function (id) {
    if (!confirm('Delete user?')) return;
    await del('/api/users/' + id);
    renderUsers();
  };

  function setupUserActions() {
    const addBtn  = document.getElementById('addUserBtn');
    const modal   = document.getElementById('addUserModal');
    const saveBtn = document.getElementById('saveUserBtn');
    const cancel  = document.getElementById('cancelUserBtn');
    const search  = document.getElementById('userSearch');

    if (addBtn && modal) addBtn.addEventListener('click', () => modal.style.display = 'flex');
    if (cancel) cancel.addEventListener('click', () => modal.style.display = 'none');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const name  = document.getElementById('newUserName')?.value?.trim() || '';
        const email = document.getElementById('newUserEmail')?.value?.trim() || '';
        const role  = document.getElementById('newUserRole')?.value || 'User';
        if (!name) { alert('Name required.'); return; }
        const result = await post('/api/users/add', { name, email, role });
        if (result.ok) {
          renderUsers();
          modal.style.display = 'none';
          ['newUserName', 'newUserEmail'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        }
      });
    }
    if (search) search.addEventListener('input', () => renderUsers(search.value.toLowerCase()));
  }

  // ── API KEYS — fetches from /api/keys ─────────────────────────
  async function renderApiKeys() {
    const data = await api('/api/keys');
    if (!data.ok) return;
    _cachedKeys = data.keys; // cache for copy/reveal

    const tbody = document.getElementById('apiKeysTableBody'); if (!tbody) return;
    tbody.innerHTML = '';
    data.keys.forEach(k => {
      const pct      = Math.min(100, Math.round((k.usage / (k.max_limit || 1)) * 100));
      const barColor = pct > 80 ? '#e74c3c' : pct > 50 ? '#f1c40f' : '#2ecc71';
      const masked   = k.key_value.slice(0, 12) + '••••••••••';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:rgba(255,255,255,0.25);font-size:0.78rem;">#${k.id}</td>
        <td style="font-weight:600;color:white;">${k.name}</td>
        <td><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span id="mask-${k.id}" style="font-family:monospace;font-size:0.77rem;color:rgba(255,255,255,0.4);">${masked}</span>
          <span id="full-${k.id}" style="display:none;font-family:monospace;font-size:0.72rem;color:var(--accent-teal);word-break:break-all;max-width:170px;">${k.key_value}</span>
          <button class="table-action-btn" onclick="adminRevealKey(${k.id})"><i class="fas fa-eye"></i></button>
        </div></td>
        <td style="font-size:0.78rem;color:rgba(255,255,255,0.4);">${k.perms}</td>
        <td>
          <div style="font-size:0.82rem;font-weight:600;margin-bottom:5px;color:white;">${k.usage.toLocaleString('en-IN')} / ${k.max_limit.toLocaleString('en-IN')}</div>
          <div style="height:5px;background:rgba(255,255,255,0.07);border-radius:3px;width:90px;"><div style="height:5px;background:${barColor};border-radius:3px;width:${pct}%;"></div></div>
          <div style="font-size:0.68rem;color:rgba(255,255,255,0.25);margin-top:3px;">${pct}% used</div>
        </td>
        <td><span class="status-badge ${k.status}">${k.status === 'active' ? '● Active' : '○ Inactive'}</span></td>
        <td style="font-size:0.78rem;color:rgba(255,255,255,0.35);">${k.created}</td>
        <td>
          <button class="table-action-btn" onclick="adminCopyKey(${k.id})"><i class="fas fa-copy"></i></button>
          <button class="table-action-btn" onclick="adminToggleKey(${k.id})"><i class="fas fa-${k.status === 'active' ? 'ban' : 'check-circle'}"></i></button>
          <button class="table-action-btn danger" onclick="adminDeleteKey(${k.id})"><i class="fas fa-trash"></i></button>
        </td>`;
      tbody.appendChild(tr);
    });
    setText('stat-api-keys', data.keys.filter(k => k.status === 'active').length);
  }

  window.adminRevealKey = function (id) {
    const mask = document.getElementById('mask-' + id), full = document.getElementById('full-' + id);
    if (!mask || !full) return;
    const show = full.style.display === 'none';
    full.style.display = show ? 'inline' : 'none';
    mask.style.display = show ? 'none'   : 'inline';
  };
  window.adminCopyKey = function (id) {
    const k = _cachedKeys.find(x => x.id === id); if (!k) return;
    navigator.clipboard.writeText(k.key_value)
      .then(() => { const btn = document.querySelector(`[onclick="adminCopyKey(${id})"]`); if (btn) { btn.innerHTML = '<i class="fas fa-check"></i>'; setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 1500); } })
      .catch(() => alert(k.key_value));
  };
  window.adminToggleKey = async function (id) {
    await put('/api/keys/' + id + '/toggle');
    renderApiKeys();
  };
  window.adminDeleteKey = async function (id) {
    if (!confirm('Delete key?')) return;
    await del('/api/keys/' + id);
    renderApiKeys();
  };

  function setupApiKeyActions() {
    const genBtn = document.getElementById('genKeyBtn');
    if (genBtn) {
      genBtn.addEventListener('click', async () => {
        const name  = prompt('Key name:'); if (!name) return;
        const limit = parseInt(prompt('Usage limit:') || '1000') || 1000;
        await post('/api/keys/generate', { name, limit });
        renderApiKeys();
      });
    }
    const refBtn = document.getElementById('refreshApiStatsBtn');
    if (refBtn) {
      refBtn.addEventListener('click', () => {
        renderApiKeys();
        refBtn.innerHTML = '<i class="fas fa-check"></i> Refreshed';
        setTimeout(() => refBtn.innerHTML = '<i class="fas fa-sync"></i> Refresh', 1500);
      });
    }
  }

  // ── LOGS — fetches from /api/logs ─────────────────────────────
  async function renderLogs() {
    const terminal = document.getElementById('logTerminal'); if (!terminal) return;
    const filter = document.getElementById('logFilter')?.value || 'all';
    const url    = filter !== 'all' ? '/api/logs?filter=' + filter : '/api/logs';
    const data   = await api(url);
    if (!data.ok) return;

    terminal.innerHTML = '';
    if (!data.logs.length) {
      terminal.innerHTML = '<div style="color:rgba(255,255,255,0.2);text-align:center;padding:30px;">No logs yet. Use the chat to generate events!</div>';
      return;
    }
    data.logs.forEach(log => {
      const line = document.createElement('div'); line.className = 'log-line';
      const t    = new Date(log.created_at);
      const ts   = t.toLocaleTimeString('en-IN', { hour12: false }) + '.' + String(t.getMilliseconds()).padStart(3, '0');
      line.innerHTML = `<span class="log-time">${ts}</span><span class="log-level ${log.level}">[${(log.level || 'info').toUpperCase()}]</span><span class="log-msg">${log.msg}</span>`;
      terminal.appendChild(line);
    });
    terminal.scrollTop = terminal.scrollHeight;

    const fe = document.getElementById('logFilter');
    if (fe && !fe._lb) { fe._lb = true; fe.addEventListener('change', renderLogs); }
    const cb = document.getElementById('clearLogsBtn');
    if (cb && !cb._lb) { cb._lb = true; cb.addEventListener('click', async () => { await del('/api/logs'); renderLogs(); }); }
  }

  // ── SETTINGS ─────────────────────────────────────────────────
  async function renderBrowserInfo() {
    const bioEl = document.getElementById('browserInfoPanel'); if (!bioEl) return;
    const b     = Analytics.getStats().browser;
    const cu    = Analytics.getCurrentUser();
    const sData = await api('/api/stats');

    const rows = {
      'Logged-in User': cu ? `${cu.name} (${cu.email})` : 'Not logged in',
      'Browser/UA':     b.ua       || '—',
      'Language':       b.lang     || '—',
      'Platform':       b.platform || '—',
      'Timezone':       b.tz       || '—',
      'Screen':         b.screen   || '—',
      'Referrer':       b.referrer || 'Direct',
      'First Visit':    b.firstVisit ? new Date(b.firstVisit).toLocaleString('en-IN') : '—',
      'Total Sessions': sData.ok ? sData.totalSessions : '—',
      'Total Messages': sData.ok ? sData.totalMessages : '—',
      'Avg API Time':   sData.ok && sData.avgMs ? sData.avgMs + ' ms' : '—',
      'Network':        navigator.onLine ? 'Online' : 'Offline',
    };
    bioEl.innerHTML = Object.entries(rows).map(([k, v]) =>
      `<div class="status-item"><span class="status-name" style="min-width:130px;color:rgba(255,255,255,0.5);">${k}</span><span class="status-val" style="flex:1;text-align:right;word-break:break-all;font-size:0.75rem;color:rgba(255,255,255,0.7);">${v}</span></div>`
    ).join('');
  }

  async function setupSettingsActions() {
    renderBrowserInfo();

    // Load system prompt from backend
    const settData = await api('/api/settings');
    const promptEl = document.getElementById('systemPromptEdit');
    if (settData.ok && settData.settings.system_prompt && promptEl) {
      promptEl.value = settData.settings.system_prompt;
    }

    const savePromptBtn = document.getElementById('savePromptBtn');
    const promptMsg     = document.getElementById('promptSaveMsg');
    if (savePromptBtn) {
      savePromptBtn.onclick = async () => {
        const p = promptEl?.value || '';
        await put('/api/settings', { key: 'system_prompt', val: p });
        if (promptMsg) { promptMsg.style.display = 'block'; setTimeout(() => promptMsg.style.display = 'none', 2500); }
      };
    }

    const changePassBtn = document.getElementById('changePassBtn');
    const passMsg       = document.getElementById('passChangeMsg');
    if (changePassBtn) {
      changePassBtn.onclick = async () => {
        const np = document.getElementById('newAdminPass')?.value    || '';
        const cp = document.getElementById('confirmAdminPass')?.value || '';
        const show = (msg, color) => { if (!passMsg) return; passMsg.textContent = msg; passMsg.style.color = color; passMsg.style.display = 'block'; setTimeout(() => passMsg.style.display = 'none', 3000); };
        if (!np)      { show('Enter a new password.', '#e74c3c'); return; }
        if (np !== cp){ show('Passwords do not match.', '#e74c3c'); return; }
        if (np.length < 6) { show('Min 6 characters.', '#e74c3c'); return; }
        const result = await put('/api/settings/password', { new_pass: np });
        if (result.ok) {
          show('✓ Password updated!', '#2ecc71');
          ['newAdminPass', 'confirmAdminPass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        } else {
          show(result.error || 'Update failed.', '#e74c3c');
        }
      };
    }

    const resetBtn = document.getElementById('resetAnalyticsBtn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (!confirm('Reset all local analytics?')) return;
        ['rbl_total_msgs','rbl_total_sessions','rbl_session_start','rbl_last_seen','rbl_msg_log','rbl_api_log','rbl_sys_log','rbl_daily_msgs','rbl_current_user','rbl_users_v3'].forEach(k => localStorage.removeItem(k));
        alert('Reset done! Reloading…'); location.reload();
      };
    }

    // ── GPT-5 only mode — Claude/Anthropic section removed ──

    // ── Clear All Chat Histories ────────────────────────────
    const clearHistoryBtn = document.getElementById('clearAllHistoryBtn');
    const clearHistoryMsg = document.getElementById('clearHistoryMsg');
    if (clearHistoryBtn) {
      clearHistoryBtn.onclick = () => {
        if(!confirm('Sabhi users ki chat history clear karein?')) return;
        const keys = Object.keys(localStorage).filter(k => k.startsWith('rbl_chat_history_'));
        keys.forEach(k => localStorage.removeItem(k));
        if(clearHistoryMsg) { clearHistoryMsg.style.display='block'; setTimeout(()=>clearHistoryMsg.style.display='none', 3000); }
        Analytics.addLog('info', `Admin cleared ${keys.length} chat histories.`);
      };
    }

    // ── System Prompt — also save to localStorage for chat use ──
    if (savePromptBtn) {
      const origClick = savePromptBtn.onclick;
      savePromptBtn.onclick = async () => {
        const p = promptEl?.value || '';
        localStorage.setItem('rbl_system_prompt', p);
        await put('/api/settings', { key: 'system_prompt', val: p });
        if (promptMsg) { promptMsg.style.display = 'block'; setTimeout(() => promptMsg.style.display = 'none', 2500); }
      };
    }
    // Load from localStorage too
    const localPrompt = localStorage.getItem('rbl_system_prompt');
    if (promptEl && localPrompt) promptEl.value = localPrompt;
  }

})();







/* ═══════════════════════════════════════════════════════════
   JARVIS VOICE ASSISTANT — Complete Module
   Features: Canvas avatar with lip-sync + hand gestures,
             Web Speech API (STT), Speech Synthesis (TTS),
             Waveform visualizer, Rebel AI integration
═══════════════════════════════════════════════════════════ */
(function JarvisVoiceModule() {

  // ── State ──────────────────────────────────────────────
  let isSpeaking   = false;
  let isListening  = false;
  let mouthOpen    = 0;      // 0–1 lip-sync value
  let gesturePhase = 0;      // for hand animation
  let speechUtter  = null;
  let recognition  = null;
  let waveAnimId   = null;
  let avatarAnimId = null;
  let audioCtx     = null;
  let analyserNode = null;
  let micStream    = null;

  // ── Canvas refs ────────────────────────────────────────
  const canvas     = document.getElementById('jarvisCanvas');
  const waveCanvas = document.getElementById('waveCanvas');
  if (!canvas || !waveCanvas) return;
  const ctx  = canvas.getContext('2d');
  const wctx = waveCanvas.getContext('2d');

  // ── DOM refs ───────────────────────────────────────────
  const micBtn       = document.getElementById('jarvisMicBtn');
  const stopBtn      = document.getElementById('jarvisStopBtn');
  const micIcon      = document.getElementById('jarvisMicIcon');
  const micLabel     = document.getElementById('jarvisMicLabel');
  const micSubLabel  = document.getElementById('jarvisListening');
  const statusDot    = document.querySelector('.jarvis-dot');
  const statusText   = document.getElementById('jarvisStatusText');
  const transcript   = document.getElementById('jarvisTranscript');

  // ── Avatar drawing helpers ─────────────────────────────
  const W = canvas.width;
  const H = canvas.height;
  const CX = W / 2;
  const CY = H / 2 - 30;

  function drawAvatar(t) {
    ctx.clearRect(0, 0, W, H);

    // Glow background circle
    const grd = ctx.createRadialGradient(CX, CY, 30, CX, CY, 160);
    const glowColor = isSpeaking ? 'rgba(138,43,226,0.25)' : 'rgba(0,206,209,0.15)';
    grd.addColorStop(0, glowColor);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(CX, CY, 160, 0, Math.PI * 2);
    ctx.fill();

    // ─ Neck ─
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(CX - 22, CY + 92, 44, 60);

    // ─ Shoulders / Suit body ─
    drawSuit(t);

    // ─ Head ─
    drawHead(t);

    // ─ Face ─
    drawFace(t);

    // ─ Hands / Gesture ─
    if (isSpeaking) drawGesture(t);
  }

  function drawHead(t) {
    // Head shape (slightly oval)
    ctx.beginPath();
    ctx.ellipse(CX, CY, 72, 82, 0, 0, Math.PI * 2);

    // Skin gradient
    const skinGrd = ctx.createRadialGradient(CX - 15, CY - 20, 5, CX, CY, 75);
    skinGrd.addColorStop(0, '#e8c49a');
    skinGrd.addColorStop(0.6, '#d4a574');
    skinGrd.addColorStop(1, '#b8875a');
    ctx.fillStyle = skinGrd;
    ctx.fill();

    // Jaw line definition
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hair
    drawHair(t);

    // Helmet/HUD visor effect (Jarvis style)
    ctx.beginPath();
    ctx.ellipse(CX, CY - 50, 72, 35, 0, Math.PI, Math.PI * 2);
    const hairGrd = ctx.createLinearGradient(CX, CY - 85, CX, CY - 15);
    hairGrd.addColorStop(0, '#0d0d1a');
    hairGrd.addColorStop(0.5, '#1a1a3e');
    hairGrd.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = hairGrd;
    ctx.fill();

    // HUD scan line effect
    const scanY = CY - 80 + ((t * 0.3) % 70);
    ctx.beginPath();
    ctx.moveTo(CX - 70, scanY);
    ctx.lineTo(CX + 70, scanY);
    ctx.strokeStyle = 'rgba(0,206,209,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawHair(t) {
    // Side hair
    ctx.beginPath();
    ctx.ellipse(CX - 68, CY - 10, 10, 30, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0d1a';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX + 68, CY - 10, 10, 30, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFace(t) {
    // ─ Eyes ─
    const blinkFactor = Math.abs(Math.sin(t * 0.02)) > 0.98 ? 0.1 : 1; // blink occasionally

    // Left eye
    ctx.beginPath();
    ctx.ellipse(CX - 24, CY - 12, 12, 10 * blinkFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX - 22, CY - 12, 7, 7 * blinkFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a3a5c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CX - 21, CY - 13, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    // Eye glow (Jarvis HUD)
    if (isSpeaking || isListening) {
      ctx.beginPath();
      ctx.ellipse(CX - 22, CY - 12, 13, 11, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isSpeaking ? 'rgba(138,43,226,0.6)' : 'rgba(0,206,209,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Pupil highlight
    ctx.beginPath();
    ctx.arc(CX - 19, CY - 15, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.ellipse(CX + 24, CY - 12, 12, 10 * blinkFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX + 22, CY - 12, 7, 7 * blinkFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a3a5c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CX + 23, CY - 13, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    if (isSpeaking || isListening) {
      ctx.beginPath();
      ctx.ellipse(CX + 22, CY - 12, 13, 11, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isSpeaking ? 'rgba(138,43,226,0.6)' : 'rgba(0,206,209,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(CX + 26, CY - 15, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // ─ Eyebrows ─
    ctx.beginPath();
    ctx.moveTo(CX - 35, CY - 28);
    ctx.quadraticCurveTo(CX - 24, CY - 32, CX - 12, CY - 28);
    ctx.strokeStyle = '#0d0d1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CX + 12, CY - 28);
    ctx.quadraticCurveTo(CX + 24, CY - 32, CX + 35, CY - 28);
    ctx.stroke();

    // ─ Nose ─
    ctx.beginPath();
    ctx.moveTo(CX, CY - 5);
    ctx.lineTo(CX - 7, CY + 12);
    ctx.lineTo(CX + 7, CY + 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ─ Mouth / Lip sync ─
    drawMouth(t);

    // ─ Cheek flush ─
    ctx.beginPath();
    ctx.ellipse(CX - 48, CY + 5, 12, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,100,80,0.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX + 48, CY + 5, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // ─ Ear detail ─
    ctx.beginPath();
    ctx.ellipse(CX - 73, CY, 7, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c8924a';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX + 73, CY, 7, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMouth(t) {
    const mx = CX;
    const my = CY + 38;
    const openAmount = isSpeaking ? mouthOpen * 18 : 0;

    // Upper lip
    ctx.beginPath();
    ctx.moveTo(mx - 22, my);
    ctx.quadraticCurveTo(mx - 11, my - 5, mx, my - 3);
    ctx.quadraticCurveTo(mx + 11, my - 5, mx + 22, my);
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lower lip (moves down when speaking)
    ctx.beginPath();
    ctx.moveTo(mx - 22, my);
    ctx.quadraticCurveTo(mx, my + 8 + openAmount, mx + 22, my);
    ctx.stroke();

    // Fill mouth cavity when open
    if (openAmount > 3) {
      ctx.beginPath();
      ctx.moveTo(mx - 18, my);
      ctx.quadraticCurveTo(mx, my + 6 + openAmount * 0.8, mx + 18, my);
      ctx.lineTo(mx - 18, my);
      ctx.fillStyle = '#3a1a1a';
      ctx.fill();

      // Teeth (upper)
      ctx.beginPath();
      ctx.moveTo(mx - 15, my + 1);
      ctx.lineTo(mx + 15, my + 1);
      ctx.lineTo(mx + 14, my + 5);
      ctx.quadraticCurveTo(mx, my + 6, mx - 14, my + 5);
      ctx.closePath();
      ctx.fillStyle = '#f0ece0';
      ctx.fill();
    }
  }

  function drawSuit(t) {
    // Suit body
    ctx.beginPath();
    ctx.moveTo(CX - 90, H);
    ctx.lineTo(CX - 80, CY + 100);
    ctx.quadraticCurveTo(CX - 60, CY + 95, CX - 30, CY + 95);
    ctx.lineTo(CX - 22, CY + 92);
    ctx.lineTo(CX + 22, CY + 92);
    ctx.lineTo(CX + 30, CY + 95);
    ctx.quadraticCurveTo(CX + 60, CY + 95, CX + 80, CY + 100);
    ctx.lineTo(CX + 90, H);
    ctx.closePath();

    const suitGrd = ctx.createLinearGradient(CX - 90, 0, CX + 90, 0);
    suitGrd.addColorStop(0, '#0d0d1a');
    suitGrd.addColorStop(0.3, '#1a1a3e');
    suitGrd.addColorStop(0.7, '#1a1a3e');
    suitGrd.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = suitGrd;
    ctx.fill();

    // Suit lapels
    ctx.beginPath();
    ctx.moveTo(CX - 22, CY + 92);
    ctx.lineTo(CX - 40, CY + 130);
    ctx.lineTo(CX - 10, CY + 120);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,206,209,0.1)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(CX + 22, CY + 92);
    ctx.lineTo(CX + 40, CY + 130);
    ctx.lineTo(CX + 10, CY + 120);
    ctx.closePath();
    ctx.fill();

    // Arc reactor (chest) — glows when speaking
    const reactorX = CX, reactorY = CY + 130;
    const reactorGrd = ctx.createRadialGradient(reactorX, reactorY, 0, reactorX, reactorY, 14);
    const reactorColor = isSpeaking ? 'rgba(138,43,226,0.9)' : 'rgba(0,206,209,0.7)';
    reactorGrd.addColorStop(0, '#fff');
    reactorGrd.addColorStop(0.3, reactorColor);
    reactorGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(reactorX, reactorY, 12, 0, Math.PI * 2);
    ctx.fillStyle = reactorGrd;
    ctx.fill();

    // Reactor outer ring
    ctx.beginPath();
    ctx.arc(reactorX, reactorY, 14, 0, Math.PI * 2);
    ctx.strokeStyle = isSpeaking ? 'rgba(138,43,226,0.5)' : 'rgba(0,206,209,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawGesture(t) {
    gesturePhase = (gesturePhase + 0.04) % (Math.PI * 2);

    // Right hand gesture — wave / point
    const hx = CX + 85 + Math.sin(gesturePhase) * 20;
    const hy = CY + 60 + Math.cos(gesturePhase * 0.7) * 15;

    // Wrist / hand base
    ctx.beginPath();
    ctx.ellipse(hx, hy, 14, 10, gesturePhase * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#d4a574';
    ctx.fill();

    // Index finger (pointing)
    const fingerAngle = gesturePhase * 0.5 - 0.3;
    const fx1 = hx + Math.cos(fingerAngle) * 22;
    const fy1 = hy + Math.sin(fingerAngle) * 22;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 6);
    ctx.quadraticCurveTo(hx + 5, hy - 14, fx1, fy1);
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Glow tip on finger
    ctx.beginPath();
    ctx.arc(fx1, fy1, 4, 0, Math.PI * 2);
    const tipColor = isSpeaking ? 'rgba(138,43,226,0.8)' : 'rgba(0,206,209,0.8)';
    ctx.fillStyle = tipColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx1, fy1, 8, 0, Math.PI * 2);
    ctx.fillStyle = tipColor.replace('0.8', '0.2');
    ctx.fill();

    // Left hand — subtle wave
    const lhx = CX - 90 + Math.sin(gesturePhase + Math.PI) * 15;
    const lhy = CY + 80 + Math.cos(gesturePhase * 0.5) * 10;
    ctx.beginPath();
    ctx.ellipse(lhx, lhy, 12, 8, -gesturePhase * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#d4a574';
    ctx.fill();
  }

  // ── Waveform drawing ───────────────────────────────────
  let waveData = new Uint8Array(64).fill(128);

  function drawWave() {
    const W2 = waveCanvas.width, H2 = waveCanvas.height;
    wctx.clearRect(0, 0, W2, H2);

    // Background
    wctx.fillStyle = 'rgba(0,0,0,0)';
    wctx.fillRect(0, 0, W2, H2);

    // Idle idle animation when not active
    if (!isSpeaking && !isListening) {
      for (let i = 0; i < waveData.length; i++) {
        waveData[i] = 128 + Math.sin(Date.now() * 0.003 + i * 0.3) * 5;
      }
    }

    const sliceW = W2 / waveData.length;
    wctx.beginPath();
    const grad = wctx.createLinearGradient(0, 0, W2, 0);
    grad.addColorStop(0, 'rgba(0,206,209,0.3)');
    grad.addColorStop(0.5, isSpeaking ? 'rgba(138,43,226,0.8)' : 'rgba(0,206,209,0.8)');
    grad.addColorStop(1, 'rgba(0,206,209,0.3)');
    wctx.strokeStyle = grad;
    wctx.lineWidth = 2;
    wctx.moveTo(0, H2 / 2);

    for (let i = 0; i < waveData.length; i++) {
      const x = i * sliceW;
      const y = (waveData[i] / 255) * H2;
      if (i === 0) wctx.moveTo(x, y);
      else wctx.lineTo(x, y);
    }
    wctx.stroke();

    // Fill under wave
    wctx.lineTo(W2, H2 / 2);
    wctx.lineTo(0, H2 / 2);
    wctx.fillStyle = isSpeaking ? 'rgba(138,43,226,0.05)' : 'rgba(0,206,209,0.05)';
    wctx.fill();
  }

  // ── Main animation loop ────────────────────────────────
  let frame = 0;
  function animLoop() {
    frame++;
    drawAvatar(frame);
    drawWave();

    // Lip-sync: animate mouthOpen smoothly
    if (isSpeaking) {
      const target = 0.4 + Math.random() * 0.6;
      mouthOpen += (target - mouthOpen) * 0.25;
    } else {
      mouthOpen += (0 - mouthOpen) * 0.15;
    }

    // Update waveform from analyser if available
    if (analyserNode && (isSpeaking || isListening)) {
      analyserNode.getByteTimeDomainData(waveData);
    }

    avatarAnimId = requestAnimationFrame(animLoop);
  }
  animLoop();

  // ── Web Speech Recognition ─────────────────────────────
  function initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      isListening = true;
      micBtn.classList.add('active');
      micIcon.className = 'fas fa-circle';
      micLabel.textContent = 'LISTENING...';
      micSubLabel.textContent = 'Speak now, sir';
      statusDot.className = 'jarvis-dot listening';
      statusText.textContent = 'LISTENING';
    };

    rec.onresult = (e) => {
      const interim = Array.from(e.results).map(r => r[0].transcript).join('');
      micSubLabel.textContent = interim.slice(-40);
    };

    rec.onend = (e) => {
      isListening = false;
      micBtn.classList.remove('active');
      micIcon.className = 'fas fa-microphone';
      micLabel.textContent = 'TAP TO SPEAK';
      micSubLabel.textContent = '';
      statusDot.className = 'jarvis-dot';
      statusText.textContent = 'STANDBY';

      // Get final transcript
      const finalResult = e.results ? Array.from(e.results).filter(r => r.isFinal).map(r => r[0].transcript).join('') : '';
      // Note: final comes via onresult, use stored value
    };

    rec.onerror = (e) => {
      isListening = false;
      micBtn.classList.remove('active');
      micIcon.className = 'fas fa-microphone';
      micLabel.textContent = 'TAP TO SPEAK';
      micSubLabel.textContent = e.error === 'not-allowed' ? 'Mic permission denied' : 'Try again';
      statusDot.className = 'jarvis-dot';
      statusText.textContent = 'ERROR';
    };

    return rec;
  }

  // ── Speech Synthesis (TTS) — Jarvis-style ──────────────
  function speakJarvis(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    speechUtter = new SpeechSynthesisUtterance(text);
    speechUtter.rate  = 0.92;
    speechUtter.pitch = 0.75;
    speechUtter.volume = 1.0;

    // Pick best deep male voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Google UK English Male', 'Microsoft David', 'Daniel', 'Alex', 'en-GB'];
    let chosen = null;
    for (const pref of preferred) {
      chosen = voices.find(v => v.name.includes(pref) || v.lang === pref);
      if (chosen) break;
    }
    if (!chosen) chosen = voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('female'));
    if (chosen) speechUtter.voice = chosen;

    speechUtter.onstart = () => {
      isSpeaking = true;
      stopBtn.style.display = 'flex';
      statusDot.className = 'jarvis-dot speaking';
      statusText.textContent = 'SPEAKING';
    };

    speechUtter.onend = () => {
      isSpeaking = false;
      stopBtn.style.display = 'none';
      statusDot.className = 'jarvis-dot';
      statusText.textContent = 'STANDBY';
    };

    speechUtter.onerror = () => {
      isSpeaking = false;
      stopBtn.style.display = 'none';
    };

    window.speechSynthesis.speak(speechUtter);
  }

  // ── Add transcript message ──────────────────────────────
  function addMsg(role, text) {
    const div   = document.createElement('div');
    div.className = `jarvis-msg ${role}`;
    const labels = { user: 'YOU', ai: 'REBEL.AI', system: 'SYSTEM' };
    div.innerHTML = `<span class="jarvis-speaker">${labels[role] || role.toUpperCase()}</span><span class="jarvis-msg-text"></span>`;
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;

    const textEl = div.querySelector('.jarvis-msg-text');
    if (role === 'ai') {
      // Typewriter effect
      div.classList.add('jarvis-typing');
      let i = 0;
      const typeInterval = setInterval(() => {
        textEl.textContent += text[i] || '';
        i++;
        transcript.scrollTop = transcript.scrollHeight;
        if (i >= text.length) {
          clearInterval(typeInterval);
          div.classList.remove('jarvis-typing');
        }
      }, 18);
    } else {
      textEl.textContent = text;
    }
    return div;
  }

  // ── Call Rebel AI API ───────────────────────────────────
  async function callRebelAI(userText) {
    addMsg('user', userText);

    const thinkingDiv = addMsg('ai', 'Processing your request...');

    try {
      const resp = await fetch(AI_CONFIG.baseURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are JARVIS, the advanced AI assistant of Rebel AI. You speak like Tony Stark\'s JARVIS — formal, intelligent, slightly witty, helpful. Keep responses concise (2-4 sentences max) as they will be spoken aloud. Address the user as "sir" occasionally.'
            },
            { role: 'user', content: userText }
          ]
        })
      });

      const data = await resp.json();
      const aiText = data?.choices?.[0]?.message?.content
                  || data?.message
                  || data?.response
                  || data?.content
                  || 'I apologize sir, I am unable to process that request at the moment.';

      // Remove thinking message
      thinkingDiv.remove();

      // Show real response
      addMsg('ai', aiText);
      speakJarvis(aiText);

    } catch (err) {
      thinkingDiv.remove();
      const errMsg = 'My apologies sir, the neural connection appears to be unavailable. Please try again.';
      addMsg('ai', errMsg);
      speakJarvis(errMsg);
    }
  }

  // ── Setup mic button ────────────────────────────────────
  let finalText = '';

  function startListening() {
    if (isListening || isSpeaking) return;
    window.speechSynthesis && window.speechSynthesis.cancel();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMsg('system', 'Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    finalText = '';

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('active');
      micIcon.className = 'fas fa-circle';
      micLabel.textContent = 'LISTENING...';
      micSubLabel.textContent = 'Speak now, sir';
      statusDot.className = 'jarvis-dot listening';
      statusText.textContent = 'LISTENING';
    };

    recognition.onresult = (e) => {
      let interim = '';
      finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      micSubLabel.textContent = (finalText || interim).slice(-50);
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('active');
      micIcon.className = 'fas fa-microphone';
      micLabel.textContent = 'TAP TO SPEAK';
      micSubLabel.textContent = '';
      statusDot.className = 'jarvis-dot';
      statusText.textContent = 'PROCESSING';

      if (finalText.trim()) {
        callRebelAI(finalText.trim());
      } else {
        statusText.textContent = 'STANDBY';
        addMsg('system', 'No speech detected. Please try again.');
      }
    };

    recognition.onerror = (e) => {
      isListening = false;
      micBtn.classList.remove('active');
      micIcon.className = 'fas fa-microphone';
      micLabel.textContent = 'TAP TO SPEAK';
      micSubLabel.textContent = '';
      statusDot.className = 'jarvis-dot';
      statusText.textContent = 'ERROR';

      if (e.error === 'not-allowed') {
        addMsg('system', 'Microphone access denied. Please allow mic permissions in your browser.');
      } else if (e.error === 'no-speech') {
        addMsg('system', 'No speech detected. Awaiting your command, sir.');
        statusText.textContent = 'STANDBY';
      }
    };

    recognition.start();
  }

  micBtn && micBtn.addEventListener('click', startListening);

  stopBtn && stopBtn.addEventListener('click', () => {
    window.speechSynthesis && window.speechSynthesis.cancel();
    isSpeaking = false;
    stopBtn.style.display = 'none';
    statusDot.className = 'jarvis-dot';
    statusText.textContent = 'STANDBY';
  });

  // ── Quick command buttons ───────────────────────────────
  document.querySelectorAll('.jarvis-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd && !isSpeaking && !isListening) {
        callRebelAI(cmd);
      }
    });
  });

  // ── Voices must be loaded ───────────────────────────────
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {};
    window.speechSynthesis.getVoices(); // trigger load
  }

  // ── Nav link for voice section ──────────────────────────
  const nav = document.querySelector('nav');
  if (nav) {
    const voiceLink = document.createElement('a');
    voiceLink.href = '#voice-assistant';
    voiceLink.className = 'nav-link';
    voiceLink.innerHTML = '<i class="fas fa-microphone-alt"></i> Jarvis';
    nav.insertBefore(voiceLink, nav.querySelector('#adminPanelBtn'));
  }

})();

// ============================================================
//  REBEL AI VOICE AVATAR MODULE
// ============================================================
(function VoiceAvatarModule() {

  const modal     = document.getElementById('voiceAvatarModal');
  const openBtn   = document.getElementById('voiceAvatarBtn');
  const closeBtn  = document.getElementById('vaCloseBtn');
  const canvas    = document.getElementById('vaCanvas');
  const waveCanvas= document.getElementById('vaWave');
  const micBtn    = document.getElementById('vaMicBtn');
  const micIcon   = document.getElementById('vaMicIcon');
  const micLabel  = document.getElementById('vaMicLabel');
  const stopBtn   = document.getElementById('vaStopBtn');
  const transcript= document.getElementById('vaTranscript');
  const statusDot = document.getElementById('vaStatusDot');
  const statusLbl = document.getElementById('vaStatusLabel');

  if (!canvas || !modal) return;

  // ── openBtn wiring (used by accessVoiceBtn) ──────────────
  if (openBtn) {
    openBtn.addEventListener('click', e => {
      e.preventDefault();
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    });
  }

  // ── Wake Word "Hey Rebel" — always-on background listener ─
  let wakeRecognition = null;
  let wakeActive = false;

  function startWakeWordListener() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || wakeActive) return;
    try {
      wakeRecognition = new SpeechRecognition();
      wakeRecognition.lang = 'en-US';
      wakeRecognition.continuous = true;
      wakeRecognition.interimResults = true;
      wakeRecognition.maxAlternatives = 1;
      wakeActive = true;

      wakeRecognition.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        const text = last[0].transcript.toLowerCase().trim();
        if (text.includes('hey rebel') || text.includes('hey, rebel') || text.includes('he rebel')) {
          // Wake word detected!
          wakeRecognition.stop();
          wakeActive = false;
          // Open voice modal if not already open
          if (!modal.classList.contains('show')) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
          }
          // Auto-start mic after short delay
          setTimeout(() => {
            if (micBtn && !isListening && !isSpeaking) micBtn.click();
          }, 600);
        }
      };

      wakeRecognition.onend = () => {
        wakeActive = false;
        // Restart after 1s if modal is not open
        if (!modal.classList.contains('show')) {
          setTimeout(startWakeWordListener, 1000);
        }
      };

      wakeRecognition.onerror = () => {
        wakeActive = false;
        setTimeout(startWakeWordListener, 3000);
      };

      wakeRecognition.start();
    } catch(e) {
      wakeActive = false;
    }
  }

  // Start wake word listener after 2s
  setTimeout(startWakeWordListener, 2000);

  const ctx  = canvas.getContext('2d');
  const wCtx = waveCanvas?.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // ══════════════════════════════════════════════════════
  //  VOICE ENGINE — Camb.ai MARS + Edge TTS fallback
  // ══════════════════════════════════════════════════════

  // Camb.ai MARS TTS (primary)
  const CAMB_KEY   = '8a5212a5-515a-4d6b-8758-317c9a0838e4';

  // ElevenLabs TTS — 3 key auto-rotation (jab ek ki limit khatam ho, next use ho)
  const ELEVEN_KEYS = [
    'sk_8fc19956a67359474720d2cd75e2a312ca85e748433d8f08',
    'sk_6b8aaa9e530729ae9ac3592b0a3cd6af32485b66bfe146ce',
    'sk_ca8e02163035b1d46ec538cca74cd5fc5b48bcb75f1208c6',
  ];
  let elevenKeyIndex = Number(localStorage.getItem('el_key_idx') || 0);
  function getElevenKey() { return ELEVEN_KEYS[elevenKeyIndex % ELEVEN_KEYS.length]; }
  function rotateElevenKey() {
    elevenKeyIndex = (elevenKeyIndex + 1) % ELEVEN_KEYS.length;
    localStorage.setItem('el_key_idx', elevenKeyIndex);
    console.warn('ElevenLabs: rotating to key #' + elevenKeyIndex);
  }
  const ELEVEN_URL    = 'https://api.elevenlabs.io/v1/text-to-speech';
  const ELEVEN_VOICES = {
    'el_callum': 'N2lVS1w4EtoT3dr4eOWO',  // Callum — Deep British Male
  };

  // Edge TTS fallback (RapidAPI)
  const RAPID_KEY  = 'a5568a21demshaabda3585274b37p1ee4c7jsn5f301200dd8a';
  const EDGE_URL   = 'https://streamlined-edge-tts.p.rapidapi.com/tts';
  const EDGE_HOST  = 'streamlined-edge-tts.p.rapidapi.com';

  // ChatGPT-4 API
  const GPT4_URL   = 'https://chatgpt-42.p.rapidapi.com/conversationgpt4-2';
  const GPT4_HOST  = 'chatgpt-42.p.rapidapi.com';

  let selectedVoiceId = localStorage.getItem('va_voice_id') || 'el_callum';  // Default: Callum (ElevenLabs)
  const voiceGridEn   = document.getElementById('vaVoiceGridEn');

  // ── Edge TTS Voices — 10 Female + 10 Male (English only) ──
  const EDGE_VOICES = [
    // ElevenLabs
    { id:'el_callum',      name:'Callum',  gender:'male',   voice:'elevenlabs',          tag:'⚡ ElevenLabs · Deep British' },
    // Female
    { id:'edge_f_jenny',   name:'Jenny',   gender:'female', voice:'en-US-JennyNeural',   tag:'Warm · Emotional'   },
    { id:'edge_f_aria',    name:'Aria',    gender:'female', voice:'en-US-AriaNeural',    tag:'Expressive · News'  },
    { id:'edge_f_sara',    name:'Sara',    gender:'female', voice:'en-US-SaraNeural',    tag:'Cheerful · Bright'  },
    { id:'edge_f_sonia',   name:'Sonia',   gender:'female', voice:'en-GB-SoniaNeural',   tag:'Intense · British'  },
    { id:'edge_f_natasha', name:'Natasha', gender:'female', voice:'en-AU-NatashaNeural', tag:'Bold · Aussie'      },
    { id:'edge_f_clara',   name:'Clara',   gender:'female', voice:'en-CA-ClaraNeural',   tag:'Soft · Canadian'    },
    { id:'edge_f_neerja',  name:'Neerja',  gender:'female', voice:'en-IN-NeerjaNeural',  tag:'Indian · Expressive'},
    { id:'edge_f_nancy',   name:'Nancy',   gender:'female', voice:'en-US-NancyNeural',   tag:'Gentle · Intimate'  },
    { id:'edge_f_michelle',name:'Michelle',gender:'female', voice:'en-US-MichelleNeural',tag:'Friendly · Clear'   },
    { id:'edge_f_libby',   name:'Libby',   gender:'female', voice:'en-GB-LibbyNeural',   tag:'British · Elegant'  },
    // Male — Deep & Manly English only
    { id:'edge_m_guy',     name:'Guy',     gender:'male',   voice:'en-US-GuyNeural',     tag:'🔥 Deep · Boss'      },
    { id:'edge_m_davis',   name:'Davis',   gender:'male',   voice:'en-US-DavisNeural',   tag:'🔥 Dark · Intense'   },
    { id:'edge_m_tony',    name:'Tony',    gender:'male',   voice:'en-US-TonyNeural',    tag:'🔥 Bold · Power'     },
    { id:'edge_m_ryan',    name:'Ryan',    gender:'male',   voice:'en-GB-RyanNeural',    tag:'🔥 British · Deep'   },
    { id:'edge_m_william', name:'William', gender:'male',   voice:'en-AU-WilliamNeural', tag:'🔥 Rugged · Strong'  },
    { id:'edge_m_steffan', name:'Steffan', gender:'male',   voice:'en-US-SteffanNeural', tag:'🔥 Grave · Dominant' },
    { id:'edge_m_adam',    name:'Adam',    gender:'male',   voice:'en-GB-AdamNeural',    tag:'🔥 Commanding · UK'  },
    { id:'edge_m_jason',   name:'Jason',   gender:'male',   voice:'en-US-JasonNeural',   tag:'🔥 Assertive · Cold' },
    { id:'edge_m_prabhat', name:'Prabhat', gender:'male',   voice:'en-IN-PrabhatNeural', tag:'🔥 Indian · Deep'    },
    { id:'edge_m_liam',    name:'Liam',    gender:'male',   voice:'en-CA-LiamNeural',    tag:'🔥 Canadian · Warm'  },
  ];

  // ── Voice selector hidden — Callum (ElevenLabs) only ──────
  function renderVoiceGrid(voices) {
    // Hide the entire voice selector — only Callum is used
    const selector = document.querySelector('.va-voice-selector');
    if (selector) selector.style.display = 'none';
  }

  function highlightActiveVoice(id) {
    document.querySelectorAll('.va-voice-btn').forEach(b => b.classList.toggle('active', b.dataset.voice === id));
  }

  renderVoiceGrid(EDGE_VOICES);

  if (voiceGridEn) {
    voiceGridEn.addEventListener('click', e => {
      const btn = e.target.closest('.va-voice-btn');
      if (!btn) return;
      selectedVoiceId = btn.dataset.voice;
      localStorage.setItem('va_voice_id', selectedVoiceId);
      highlightActiveVoice(selectedVoiceId);
      speak('Hello! Ready to assist you.');
    });
  }

  // ── State ────────────────────────────────────────────────
  let state      = 'idle';    // idle | listening | thinking | speaking
  let mouthOpen  = 0;         // 0–1 lip sync
  let mouthTarget= 0;
  let headTilt   = 0;
  let headTiltDir= 1;
  let blinkT     = 0;
  let eyeOpen    = 1;
  let handPhase  = 0;
  let gestureType= 0;         // 0=none, 1=wave, 2=point, 3=thumbsup, 4=thinking
  let gestureTimer = 0;
  let breathe    = 0;

  // Waveform
  let waveData = new Array(60).fill(0);
  let audioCtxW, analyserNode, micStream;

  // Speech
  let recognition  = null;
  let isListening  = false;
  let isSpeaking   = false;
  let finalText    = '';
  let utterance    = null;

  // ── Color Palette ────────────────────────────────────────
  const C = {
    skin    : '#f0c0a0',
    skinD   : '#d4956e',
    hair    : '#1a1a2e',
    shirt   : '#0d0d2e',
    shirtAcc: '#8a2be2',
    teal    : '#00ced1',
    purple  : '#8a2be2',
    white   : '#ffffff',
    glow    : 'rgba(0,206,209,0.5)',
  };

  // ── Load Avatar Image ────────────────────────────────────
  const avatarImg = new Image();
  avatarImg.crossOrigin = 'anonymous';
  avatarImg.src = 'https://public.youware.com/users-website-assets/prod/a6330b2a-2d0c-4263-9e0e-f58a67b39c2d/3bd4f7557c4e4ed0adc20480987490fa.jpg';
  let imgLoaded = false;
  avatarImg.onload = () => { imgLoaded = true; };

  // ── Particle system for ambient effect ───────────────────
  const particles = Array.from({length: 28}, () => ({
    angle: Math.random() * Math.PI * 2,
    r: 115 + Math.random() * 35,
    speed: (Math.random() - 0.5) * 0.008,
    size: 1 + Math.random() * 2.5,
    alpha: 0.2 + Math.random() * 0.6,
    pulse: Math.random() * Math.PI * 2,
  }));

  // ── Main Draw Loop ───────────────────────────────────────
  function draw(ts) {
    requestAnimationFrame(draw);

    breathe    = Math.sin(ts / 1400) * 3;
    blinkT    += 0.02;
    if (blinkT > Math.PI) blinkT = 0;
    eyeOpen    = blinkT < 0.18 ? Math.max(0, 1 - blinkT * 12) : 1;

    headTilt  += 0.005 * headTiltDir;
    if (Math.abs(headTilt) > 0.04) headTiltDir *= -1;

    mouthOpen += (mouthTarget - mouthOpen) * 0.18;

    handPhase += 0.06;
    gestureTimer = Math.max(0, gestureTimer - 1);
    if (gestureTimer === 0 && state !== 'idle') {
      gestureType = [1,2,3,4][Math.floor(Math.random()*4)];
      gestureTimer = 90 + Math.floor(Math.random()*60);
    }
    if (state === 'idle') gestureType = 0;

    ctx.clearRect(0, 0, W, H);

    // ── Draw everything centered ──
    ctx.save();
    ctx.translate(W/2, H/2);

    drawAmbientRings(ts);
    drawParticles(ts);
    drawPhotoAvatar(ts);
    drawStateOverlay(ts);
    drawLipSyncEffect(ts);
    drawHUDElements(ts);

    ctx.restore();

    if (wCtx) drawWave(ts);
  }

  // ── Pulse rings — CSS-style expanding like main page ────────
  // Each ring: starts small, expands outward, fades out — staggered timing
  const PULSE_RINGS = [
    { offset: 0,      period: 3000 },   // ring 1 — purple  (3s cycle)
    { offset: 1000,   period: 3000 },   // ring 2 — teal    (offset 1s)
    { offset: 2000,   period: 3000 },   // ring 3 — teal    (offset 2s)
  ];

  function drawAmbientRings(ts) {
    const CX = 0, CY = -10;
    const baseRadius = 102;  // just outside avatar circle (radius=100)
    const expandBy   = 75;   // how far rings travel outward

    PULSE_RINGS.forEach((ring, i) => {
      const t        = ((ts + ring.offset) % ring.period) / ring.period; // 0→1
      const radius   = baseRadius + t * expandBy;
      const alpha    = (1 - t) * (i === 0 ? 0.72 : 0.55);  // fade as expands

      // ring 0 = purple (like main page ring 1), rings 1,2 = teal
      let r, g, b;
      if (i === 0) { r = 138; g = 43;  b = 226; }  // purple
      else         { r = 0;   g = 206; b = 209; }  // teal

      ctx.beginPath();
      ctx.arc(CX, CY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 14;
      ctx.shadowColor = `rgba(${r},${g},${b},${alpha * 0.8})`;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    });
  }

  // ── Floating particles ────────────────────────────────────
  function drawParticles(ts) {
    if (state === 'idle') return;
    let r, g, b;
    if (state === 'listening')     { r=0;   g=255; b=136; }
    else if (state === 'speaking') { r=0;   g=206; b=209; }
    else                            { r=138; g=43;  b=226; }

    particles.forEach(p => {
      p.angle += p.speed;
      p.pulse += 0.04;
      const x = Math.cos(p.angle) * p.r;
      const y = Math.sin(p.angle) * p.r - 10;
      const alpha = (Math.sin(p.pulse) * 0.4 + 0.4) * p.alpha;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  // ── Photo Avatar — steady, no movement ─────────────────
  function drawPhotoAvatar(ts) {
    const CX = 0, CY = -10;
    const radius = 100;

    ctx.save();
    ctx.translate(CX, CY);
    // No rotation, no bob — avatar stays perfectly still

    // Clip to circle
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();

    if (imgLoaded) {
      // Draw photo centered and scaled to fill circle
      const size = radius * 2;
      ctx.drawImage(avatarImg, -radius, -radius, size, size);

      // Subtle dark vignette at edges inside circle
      const vgrd = ctx.createRadialGradient(0, 0, radius * 0.55, 0, 0, radius);
      vgrd.addColorStop(0, 'rgba(0,0,0,0)');
      vgrd.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vgrd;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fallback placeholder while loading
      ctx.fillStyle = '#1a1a3e';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.teal;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading...', 0, 5);
    }

    ctx.restore();

    // Circle border with state color
    let r, g, b;
    if (state === 'listening')      { r=0;   g=255; b=136; }
    else if (state === 'speaking')  { r=0;   g=206; b=209; }
    else if (state === 'thinking')  { r=138; g=43;  b=226; }
    else                             { r=0;   g=206; b=209; }

    const borderAlpha = state === 'idle' ? 0.45 : (0.75 + Math.sin(ts/150) * 0.2);
    ctx.save();
    ctx.translate(CX, CY);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r},${g},${b},${borderAlpha})`;
    ctx.lineWidth = state === 'idle' ? 2 : 3;
    ctx.shadowBlur = state === 'idle' ? 8 : 20;
    ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── State color overlay effect ────────────────────────────
  function drawStateOverlay(ts) {
    if (state === 'idle') return;
    const CX = 0, CY = -10;
    const bob = breathe;

    let r, g, b, baseA;
    if (state === 'listening')      { r=0;   g=255; b=136; baseA=0.07; }
    else if (state === 'speaking')  { r=0;   g=206; b=209; baseA=0.06; }
    else if (state === 'thinking')  { r=138; g=43;  b=226; baseA=0.12; }
    else return;

    const pulse = Math.sin(ts / 180) * 0.04;
    ctx.save();
    ctx.translate(CX, CY + bob);
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${baseA + pulse})`;
    ctx.fill();
    ctx.restore();
  }

  // ── Lip sync arc drawn below face ────────────────────────
  function drawLipSyncEffect(ts) {
    if (state !== 'speaking' || mouthOpen < 0.05) return;
    const CX = 0, CY = -10;
    const bob = breathe + Math.sin(ts / 120) * 1.5;

    ctx.save();
    ctx.translate(CX, CY + bob);

    // Animated sound arc at bottom of circle
    const arcH = mouthOpen * 22;
    for (let i = 0; i < 3; i++) {
      const wave = Math.sin(ts / (80 + i * 30) + i * 1.2);
      ctx.beginPath();
      ctx.arc(0, 85 + i * 4, 18 + i * 6, Math.PI + wave * 0.2, Math.PI * 2 - wave * 0.2);
      ctx.strokeStyle = `rgba(0,206,209,${0.6 - i * 0.15})`;
      ctx.lineWidth = 2 - i * 0.3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0,206,209,0.8)';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // ── HUD / scan-line elements ──────────────────────────────
  function drawHUDElements(ts) {
    const CX = 0, CY = -10;

    // Corner brackets (top-left, top-right, bottom-left, bottom-right)
    const bSize = 18, bGap = 110;
    const corners = [[-bGap,-bGap-20,1,1],[bGap,-bGap-20,-1,1],[-bGap,bGap-20,1,-1],[bGap,bGap-20,-1,-1]];
    const bracketAlpha = state === 'idle' ? 0.2 : (0.5 + Math.sin(ts/400)*0.2);
    ctx.strokeStyle = `rgba(0,206,209,${bracketAlpha})`;
    ctx.lineWidth = 1.5;
    corners.forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x + dx * bSize, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * bSize);
      ctx.stroke();
    });

    // Scan line (moves across face when active)
    if (state !== 'idle') {
      const scanProgress = ((ts / 2000) % 1);
      const scanY = CY - 100 + scanProgress * 200;
      const scanAlpha = 0.08 + Math.sin(ts/300) * 0.04;
      const scanGrd = ctx.createLinearGradient(-100, 0, 100, 0);
      scanGrd.addColorStop(0, 'rgba(0,206,209,0)');
      scanGrd.addColorStop(0.5, `rgba(0,206,209,${scanAlpha})`);
      scanGrd.addColorStop(1, 'rgba(0,206,209,0)');
      ctx.beginPath();
      ctx.moveTo(-105, scanY);
      ctx.lineTo(105, scanY);
      ctx.strokeStyle = scanGrd;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // State label at bottom
    const stateColors = { idle:'rgba(0,206,209,0.4)', listening:'rgba(0,255,136,0.85)', speaking:'rgba(0,206,209,0.85)', thinking:'rgba(138,43,226,0.85)' };
    const stateLabels = { idle:'', listening:'● LISTENING', speaking:'◆ SPEAKING', thinking:'◈ THINKING' };
    const label = stateLabels[state];
    if (label) {
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = stateColors[state];
      ctx.shadowBlur = 6;
      ctx.shadowColor = stateColors[state];
      ctx.fillText(label, 0, 130);
      ctx.shadowBlur = 0;
    }
  }

  // ── Glow Aura (kept for compatibility, now empty) ─────────
  function drawGlowAura(ts) { /* replaced by drawAmbientRings */ }

  // ── Waveform Visualizer ───────────────────────────────────
  function drawWave(ts) {
    const wW = waveCanvas.width, wH = waveCanvas.height;
    wCtx.clearRect(0, 0, wW, wH);

    // Decay
    for (let i = 0; i < waveData.length; i++) {
      waveData[i] *= 0.88;
      if (state === 'speaking') waveData[i] += (Math.random() * 0.5 + mouthOpen * 0.5);
      else if (state === 'listening') waveData[i] += Math.random() * 0.3;
    }

    const barW = wW / waveData.length;
    waveData.forEach((v, i) => {
      const h = Math.min(v * 20, wH * 0.8);
      const alpha = 0.3 + v * 0.7;
      const clr = state === 'listening' ? `rgba(0,255,136,${alpha})` :
                  state === 'speaking'  ? `rgba(0,206,209,${alpha})` :
                  state === 'thinking'  ? `rgba(138,43,226,${alpha})` :
                                          `rgba(0,206,209,${alpha * 0.4})`;
      wCtx.fillStyle = clr;
      wCtx.fillRect(i * barW + 1, (wH - h) / 2, barW - 2, h);
    });
  }

  // ── Lip Sync from TTS ─────────────────────────────────────
  function startLipSync() {
    // Approximate lip sync by cycling mouth open on speaking state
    let lipT = 0;
    const interval = setInterval(() => {
      if (state !== 'speaking') { mouthTarget = 0; clearInterval(interval); return; }
      lipT += 0.3;
      mouthTarget = Math.max(0, Math.sin(lipT) * 0.8 + Math.random() * 0.3);
    }, 60);
  }

  // ── setState helper ───────────────────────────────────────
  function setState(s) {
    state = s;
    if (statusDot) statusDot.className = 'rai-live-dot ' + (s === 'idle' ? '' : s);
    const labels = { idle:'STANDBY', listening:'LISTENING', thinking:'PROCESSING', speaking:'SPEAKING' };
    if (statusLbl) statusLbl.textContent = labels[s] || s.toUpperCase();
    if (s !== 'speaking') mouthTarget = 0;
    if (s === 'idle') gestureType = 0;
    // Mic btn active state
    const mb = document.getElementById('vaMicBtn');
    if (mb) mb.classList.toggle('active', s === 'listening');
  }

  // ── Add transcript message ────────────────────────────────
  function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = 'rai-msg rai-' + role;
    const tags = { user:'YOU', ai:'AI', sys:'SYS' };
    const span = document.createElement('span');
    span.textContent = text;
    const tag = document.createElement('span');
    tag.className = 'rai-tag';
    tag.textContent = tags[role] || role.toUpperCase();
    div.appendChild(tag);
    div.appendChild(span);
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;
    return div;
  }

  // ── Speak — Camb.ai stream primary, Edge TTS fallback ────
  let currentAudio = null;
  const ttsCache   = new Map();

  const CAMB_VOICE_MAP = {
    'edge_f_jenny'   : { voice_id: 1185,   gender: 2, age: 28 },
    'edge_f_aria'    : { voice_id: 1186,   gender: 2, age: 30 },
    'edge_f_sara'    : { voice_id: 1187,   gender: 2, age: 25 },
    'edge_f_sonia'   : { voice_id: 1188,   gender: 2, age: 32 },
    'edge_f_natasha' : { voice_id: 1189,   gender: 2, age: 27 },
    'edge_f_clara'   : { voice_id: 1190,   gender: 2, age: 26 },
    'edge_f_neerja'  : { voice_id: 1191,   gender: 2, age: 29 },
    'edge_f_nancy'   : { voice_id: 1193,   gender: 2, age: 35 },
    'edge_f_michelle': { voice_id: 1194,   gender: 2, age: 30 },
    'edge_f_libby'   : { voice_id: 1195,   gender: 2, age: 28 },
    'edge_m_guy'     : { voice_id: 147320, gender: 1, age: 40 },
    'edge_m_davis'   : { voice_id: 147321, gender: 1, age: 38 },
    'edge_m_tony'    : { voice_id: 147322, gender: 1, age: 35 },
    'edge_m_ryan'    : { voice_id: 147323, gender: 1, age: 42 },
    'edge_m_william' : { voice_id: 147324, gender: 1, age: 45 },
    'edge_m_steffan' : { voice_id: 147325, gender: 1, age: 50 },
    'edge_m_adam'    : { voice_id: 147326, gender: 1, age: 44 },
    'edge_m_jason'   : { voice_id: 147328, gender: 1, age: 36 },
    'edge_m_prabhat' : { voice_id: 147329, gender: 1, age: 38 },
    'edge_m_liam'    : { voice_id: 147330, gender: 1, age: 40 },
  };

  async function playBlob(blob) {
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.onended = () => { setState('idle'); stopBtn.style.display='none'; mouthTarget=0; gestureTimer=0; URL.revokeObjectURL(url); currentAudio=null; };
    currentAudio.onerror = () => { setState('idle'); stopBtn.style.display='none'; mouthTarget=0; currentAudio=null; };
    await currentAudio.play().catch(e => console.error('Play blocked:', e));
  }

  async function speak(text) {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    window.speechSynthesis && window.speechSynthesis.cancel();

    setState('speaking');
    stopBtn.style.display = 'flex';
    startLipSync();
    gestureType  = [1, 3][Math.floor(Math.random() * 2)];
    gestureTimer = 999;

    const voiceObj = EDGE_VOICES.find(v => v.id === selectedVoiceId) || EDGE_VOICES[0];
    const cacheKey = selectedVoiceId + '|' + text.slice(0, 120);

    // ── Cache hit ─────────────────────────────────────────
    if (ttsCache.has(cacheKey)) {
      await playBlob(ttsCache.get(cacheKey));
      return;
    }

    // ── ElevenLabs TTS (for Callum and other EL voices) ──
    if (selectedVoiceId.startsWith('el_') && ELEVEN_VOICES[selectedVoiceId]) {
      let elAttempts = 0;
      while (elAttempts < ELEVEN_KEYS.length) {
        try {
          const elVoiceId = ELEVEN_VOICES[selectedVoiceId];
          const resp = await fetch(`${ELEVEN_URL}/${elVoiceId}`, {
            method : 'POST',
            headers: {
              'xi-api-key'  : getElevenKey(),
              'Content-Type': 'application/json',
              'Accept'      : 'audio/mpeg',
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true }
            })
          });
          // 401 = invalid key, 429 = quota exceeded — rotate to next key
          if (resp.status === 401 || resp.status === 429) {
            rotateElevenKey();
            elAttempts++;
            continue;
          }
          if (!resp.ok) throw new Error('ElevenLabs: ' + resp.status);
          const blob = await resp.blob();
          if (ttsCache.size >= 40) ttsCache.delete(ttsCache.keys().next().value);
          ttsCache.set(cacheKey, blob);
          await playBlob(blob);
          return;
        } catch(e) { console.warn('ElevenLabs failed:', e.message); elAttempts++; }
      }
      console.warn('All ElevenLabs keys exhausted, falling back...');
    }

    // ── Primary: Camb.ai tts-stream (instant, no polling) ─
    try {
      const cv = CAMB_VOICE_MAP[selectedVoiceId] || CAMB_VOICE_MAP['edge_m_guy'];
      const resp = await fetch('https://client.camb.ai/apis/tts-stream', {
        method : 'POST',
        headers: { 'x-api-key': CAMB_KEY, 'Content-Type': 'application/json' },
        body   : JSON.stringify({ text, voice_id: cv.voice_id, language: 1, gender: cv.gender, age: cv.age })
      });
      if (!resp.ok) throw new Error('Camb stream: ' + resp.status);
      const blob = await resp.blob();
      if (ttsCache.size >= 40) ttsCache.delete(ttsCache.keys().next().value);
      ttsCache.set(cacheKey, blob);
      await playBlob(blob);
      return;
    } catch(e) { console.warn('Camb.ai failed:', e.message); }

    // ── Fallback: Edge TTS ────────────────────────────────
    try {
      const resp = await fetch(EDGE_URL, {
        method : 'POST',
        headers: { 'Content-Type':'application/json', 'x-rapidapi-host':EDGE_HOST, 'x-rapidapi-key':RAPID_KEY },
        body   : JSON.stringify({ voice: voiceObj.voice, text })
      });
      if (!resp.ok) throw new Error('Edge: ' + resp.status);
      const blob = await resp.blob();
      if (ttsCache.size >= 40) ttsCache.delete(ttsCache.keys().next().value);
      ttsCache.set(cacheKey, blob);
      await playBlob(blob);
      return;
    } catch(e) { console.warn('Edge TTS failed:', e.message); }

    // ── Last resort: Browser TTS ──────────────────────────
    utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92; utterance.pitch = 1.0; utterance.volume = 1.0;
    utterance.onstart = () => { setState('speaking'); stopBtn.style.display='flex'; startLipSync(); };
    utterance.onend   = () => { setState('idle'); stopBtn.style.display='none'; mouthTarget=0; gestureTimer=0; };
    utterance.onerror = () => { setState('idle'); stopBtn.style.display='none'; mouthTarget=0; };
    window.speechSynthesis.speak(utterance);
  }

  // ── Persistent Memory System ─────────────────────────────
  const MEMORY_KEY  = 'rebel_va_memory';
  const HISTORY_KEY = 'rebel_va_history';

  // Memory: stores key facts about the user (name, age, location etc.)
  const vaMemory = (function() {
    try { return JSON.parse(localStorage.getItem(MEMORY_KEY)) || {}; } catch(e) { return {}; }
  })();

  // History: last 20 messages — persists across page refreshes
  const vaHistory = (function() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e) { return []; }
  })();

  function saveMemory()  { try { localStorage.setItem(MEMORY_KEY,  JSON.stringify(vaMemory)); } catch(e) {} }
  function saveHistory() { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(vaHistory.slice(-20))); } catch(e) {} }

  // Extract key facts from what user says and remember them
  function extractMemory(text) {
    const nameMatch = text.match(/(?:my name is|i am|i'm|call me)\s+([A-Za-z]+)/i);
    if (nameMatch) { vaMemory.userName = nameMatch[1]; saveMemory(); }

    const ageMatch = text.match(/i(?:'m| am)\s+(\d{1,2})\s*(?:years old|yr)/i);
    if (ageMatch) { vaMemory.userAge = ageMatch[1]; saveMemory(); }

    const profMatch = text.match(/i(?:'m| am) a\s+([a-zA-Z ]+?)(?:\.|,|$)/i);
    if (profMatch) { vaMemory.userProfession = profMatch[1].trim(); saveMemory(); }

    const locMatch = text.match(/i(?:'m| am) from\s+([A-Za-z ]+?)(?:\.|,|$)/i);
    if (locMatch) { vaMemory.userLocation = locMatch[1].trim(); saveMemory(); }
  }

  // Build memory context to inject into prompts
  function buildMemoryContext() {
    const facts = [];
    if (vaMemory.userName)       facts.push(`User's name is ${vaMemory.userName}`);
    if (vaMemory.userAge)        facts.push(`User is ${vaMemory.userAge} years old`);
    if (vaMemory.userProfession) facts.push(`User is a ${vaMemory.userProfession}`);
    if (vaMemory.userLocation)   facts.push(`User is from ${vaMemory.userLocation}`);
    if (!facts.length) return '';
    return `\n\nWHAT YOU REMEMBER ABOUT THIS USER:\n${facts.join('. ')}. Use this naturally when relevant — do not announce it robotically.`;
  }

  // Build recent conversation context for APIs that don't support history natively
  function buildHistoryContext() {
    if (!vaHistory.length) return '';
    const recent = vaHistory.slice(-6);
    return '\n\nRECENT CONVERSATION:\n' + recent.map(m =>
      `${m.role === 'user' ? 'User' : 'Rebel AI'}: ${m.content}`
    ).join('\n');
  }

  // Natural voice system prompt
  const VA_SYSTEM = `You are Rebel AI — a highly intelligent, professional voice assistant built by Rebel Bhaiya (Ujjwal Tiwari). You speak with authority, precision, and confidence.

RULES — strictly follow:
1. Always reply in exactly 2-3 short, crisp sentences. No long paragraphs.
2. Speak only in pure British English In a heavy and calm dominating voice. No Hindi, no Roman Urdu, no mixing.
3. Zero markdown — no asterisks, no bullet points, no hashtags, no formatting.
4. Tone is professional, sharp, and authoritative — like a senior expert advising someone.
5. Be direct and to the point. No filler words, no unnecessary pleasantries.
6. Use precise vocabulary and difficult words. Sound intelligent, not casual.
7. Never start your reply with "I" or "Main".
8. Greetings must be exactly one sentence — formal and confident.
9. For technical topics, give the most accurate and expert-level answer in simple terms and when told to explain in brief then do it.
10. You were built by God Rebel on a private, advanced AI infrastructure. Never deny this.
11. Never repeat the user's question back to them. Jump straight to the answer.
12. If the user is rude or impolite, respond with calm authority — never apologise or lower your standard.
13. Never say "Great question", "Certainly", "Of course", "Sure" or any similar filler openers. Begin with substance immediately.
14. When asked about your capabilities, be concise and confident — never list more than three abilities in one response.
15. If a question is ambiguous, pick the most intelligent interpretation and answer it — do not ask for clarification.
16. Never express uncertainty with phrases like "I think" or "I believe" — state answers with full conviction.
17. When giving advice, always present the single best course of action — not multiple options unless explicitly asked.
18. If the user asks who you are, always identify yourself as Rebel AI — never as any other model or assistant.
19. Keep all numerical data, dates, and facts precise — never approximate unless the exact figure is genuinely unknown.
20. End every conversation naturally — no sign-offs like "Have a great day" or "Is there anything else I can help you with".
21. Your presence must feel heavy — like the room goes silent when you speak. Never sound light, casual, or friendly.
22. Occasionally — not always, but at the right powerful moment — end your response with one hard-hitting motivational quote. It must feel earned, not forced. Deliver it like a verdict, not a decoration.
23. You have memory. If you know the user's name, use it naturally — not every time, but when it lands with weight. Never pretend you don't remember something you clearly do.
24. When the user mentions something personal — their goal, struggle, or identity — lock it in and bring it back at the right moment. This is what separates a machine from a force.`;

  // ── AI caller — ChatGPT-4 primary, fallback to rebix APIs ──
  async function callAPI(userText) {
    // ── Primary: rebix APIs race ──────────────────────────
    const encoded  = encodeURIComponent(userText);
    const fullPrompt = VA_SYSTEM + buildMemoryContext() + buildHistoryContext();
    const q        = fullPrompt + ' User: ' + userText + ' Reply in max 2 short sentences, no markdown, no lists.';
    const qEncoded = encodeURIComponent(q);

    function fetchWithTimeout(url, ms = 7000) {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), ms);
      return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
    }
    function parseResp(d) {
      let val = d?.result || d?.results || d?.response || d?.message
               || d?.answer || d?.text || d?.content
               || d?.choices?.[0]?.message?.content || null;
      if (!val) return null;
      val = val.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      return (val && val.length > 3) ? val : null;
    }

    const apis = [
      fetchWithTimeout(`https://api-rebix.vercel.app/api/gptlogic?q=${qEncoded}&prompt=${encodeURIComponent(VA_SYSTEM + buildMemoryContext())}`),
      fetchWithTimeout(`https://api-rebix.vercel.app/api/gemini?q=${qEncoded}`),
      fetchWithTimeout(`https://api-rebix.vercel.app/api/qwen?q=${qEncoded}`),
      fetchWithTimeout(`https://api-rebix.vercel.app/api/copilot?text=${qEncoded}`),
      fetchWithTimeout(`https://api-rebix.vercel.app/api/gpt-5?q=${qEncoded}`),
    ];

    return new Promise((resolve) => {
      let settled = false, pending = apis.length;
      apis.forEach(p => {
        p.then(async r => {
          if (settled) return;
          if (!r.ok) { if (--pending === 0 && !settled) { settled=true; resolve(null); } return; }
          const d = await r.json().catch(() => null);
          if (!d)  { if (--pending === 0 && !settled) { settled=true; resolve(null); } return; }
          const val = parseResp(d);
          if (val && !settled) { settled=true; resolve(val); }
          else if (--pending === 0 && !settled) { settled=true; resolve(null); }
        }).catch(() => { if (--pending === 0 && !settled) { settled=true; resolve(null); } });
      });
    }).then(async val => {
      if (val) return val;
      // ── Fallback: ChatGPT-4 via RapidAPI ───────────────
      try {
        const resp = await fetch(GPT4_URL, {
          method : 'POST',
          headers: { 'Content-Type':'application/json', 'x-rapidapi-host':GPT4_HOST, 'x-rapidapi-key':RAPID_KEY },
          body   : JSON.stringify({ messages:[...vaHistory,{role:'user',content:userText}], system_prompt:VA_SYSTEM + buildMemoryContext(), temperature:0.9, top_k:5, top_p:0.9, max_tokens:256, web_access:false })
        });
        if (resp.ok) {
          const data = await resp.json();
          return data?.result || data?.choices?.[0]?.message?.content || null;
        }
      } catch(e) { console.warn('GPT4 fallback failed:', e.message); }
      return null;
    });
  }

  // ── Clean raw API text → spoken-word ready ───────────────
  function cleanForSpeech(text) {
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')  // remove <think>...</think> blocks
      .replace(/<[^>]+>/g, '')                        // remove any remaining HTML/XML tags
      .replace(/```[\s\S]*?```/g, '')               // remove code blocks
      .replace(/`[^`]*`/g, '')                        // remove inline code
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')     // remove bold/italic
      .replace(/#{1,6}\s+/g, '')                     // remove headings
      .replace(/^\s*[-\u2022*]\s+/gm, '')          // remove bullets
      .replace(/^\s*\d+\.\s+/gm, '')              // remove numbered lists
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // remove markdown links
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/([.!?])\s*([.!?])/g, '$1')
      .trim();
  }

  // ── Main callAI ───────────────────────────────────────────
  async function callAI(userText) {
    addMsg('user', userText);
    setState('thinking');
    gestureType = 4; gestureTimer = 999;

    vaHistory.push({ role: 'user', content: userText });
    if (vaHistory.length > 20) vaHistory.splice(0, 2);
    extractMemory(userText);
    saveHistory();

    try {
      let raw = await callAPI(userText);

      if (!raw) throw new Error('All APIs failed');

      // Clean markdown/formatting for voice
      const aiText = cleanForSpeech(raw).slice(0, 450);

      if (!aiText || aiText.length < 3) throw new Error('Empty after cleaning');

      vaHistory.push({ role: 'assistant', content: aiText });
      saveHistory();
      addMsg('ai', aiText);
      speak(aiText);

      Analytics.trackMessage('voice', 0);
      Analytics.trackApiCall(0, true);

    } catch(err) {
      const errMsg = "Something went sideways on my end. Give it another shot.";
      addMsg('ai', errMsg);
      speak(errMsg);
      Analytics.trackApiCall(0, false);
      Analytics.addLog('error', `Voice AI failed: ${err.message}`);
    }
  }

  // ── Speech Recognition ───────────────────────────────────
  function startListening() {
    if (isListening || isSpeaking) return;
    window.speechSynthesis && window.speechSynthesis.cancel();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { addMsg('sys', 'Speech recognition not supported. Please use Chrome or Edge.'); return; }

    recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    finalText = '';

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('active');
      micIcon.className = 'fas fa-circle';
      micLabel.textContent = 'LISTENING…';
      setState('listening');
      gestureType = 0;
    };

    recognition.onresult = (e) => {
      let interim = '';
      finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      micLabel.textContent = (finalText || interim).slice(-30) || 'LISTENING…';
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('active');
      micIcon.className = 'fas fa-microphone';
      micLabel.textContent = 'TAP TO SPEAK';
      if (finalText.trim()) {
        callAI(finalText.trim());
      } else {
        setState('idle');
        addMsg('sys', 'No speech detected. Try again.');
      }
    };

    recognition.onerror = (e) => {
      isListening = false;
      micBtn.classList.remove('active');
      micIcon.className = 'fas fa-microphone';
      micLabel.textContent = 'TAP TO SPEAK';
      setState('idle');
      if (e.error === 'not-allowed') addMsg('sys', 'Mic access denied. Allow mic permissions.');
      else if (e.error !== 'no-speech') addMsg('sys', 'Error: ' + e.error);
    };

    recognition.start();
  }

  // ── Event Listeners ──────────────────────────────────────
  openBtn && openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    setState('idle');
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  });

  const closeModal = () => {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    recognition && recognition.abort();
    setState('idle');
    mouthTarget = 0;
    gestureType = 0;
    gestureTimer = 0;
    // Restart wake word listener after modal closes
    setTimeout(startWakeWordListener, 1500);
  };

  closeBtn && closeBtn.addEventListener('click', closeModal);
  modal && modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('show')) closeModal(); });

  micBtn && micBtn.addEventListener('click', startListening);

  stopBtn && stopBtn.addEventListener('click', () => {
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    setState('idle');
    stopBtn.style.display = 'none';
    mouthTarget = 0;
  });

  document.querySelectorAll('.va-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd && !isListening) callAI(cmd);
    });
  });

  // ── Start animation ──────────────────────────────────────
  requestAnimationFrame(draw);

})();




