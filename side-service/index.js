import { MessageBuilder } from './shared/message-side';
import { settingsStorage } from '@zos/storage';

// ─── StarLine API endpoints ───────────────────────────────────────────────────
const ID_BASE = 'https://id.starline.ru/apiV3';
const DEV_BASE = 'https://dev.starline.ru/json/v2';

// Token cache lifetime: 4 hours (in ms)
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

// Minimum interval between status requests (90 sec)
const MIN_STATUS_INTERVAL_MS = 90 * 1000;

const messageBuilder = new MessageBuilder();

let cachedToken = null;       // slnet cookie value
let tokenExpiry = 0;          // epoch ms when token expires
let lastStatusTime = 0;       // epoch ms of last status fetch
let cachedStatus = null;      // last known device status

// ─── SHA1 helper (required by StarLine API for password hashing) ──────────────
// Implements SHA-1 in pure JS (no crypto module in Side Service environment)
function sha1(str) {
  function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
  function tohex(n) {
    let s = '';
    for (let i = 7; i >= 0; i--) s += ((n >>> (i * 4)) & 0xf).toString(16);
    return s;
  }

  const msg = unescape(encodeURIComponent(str));
  const msgLen = msg.length;
  const wordArray = [];

  for (let i = 0; i < msgLen - 3; i += 4) {
    wordArray.push(
      (msg.charCodeAt(i) << 24) |
      (msg.charCodeAt(i + 1) << 16) |
      (msg.charCodeAt(i + 2) << 8) |
      msg.charCodeAt(i + 3)
    );
  }

  switch (msgLen % 4) {
    case 0: wordArray.push(0x80000000); break;
    case 1: wordArray.push((msg.charCodeAt(msgLen - 1) << 24) | 0x800000); break;
    case 2: wordArray.push((msg.charCodeAt(msgLen - 2) << 24) | (msg.charCodeAt(msgLen - 1) << 16) | 0x8000); break;
    case 3: wordArray.push((msg.charCodeAt(msgLen - 3) << 24) | (msg.charCodeAt(msgLen - 2) << 16) | (msg.charCodeAt(msgLen - 1) << 8) | 0x80); break;
  }

  while (wordArray.length % 16 !== 14) wordArray.push(0);
  wordArray.push(msgLen >>> 29);
  wordArray.push((msgLen << 3) & 0xffffffff);

  let H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0;

  for (let blockstart = 0; blockstart < wordArray.length; blockstart += 16) {
    const W = wordArray.slice(blockstart, blockstart + 16);
    for (let i = 16; i < 80; i++) W[i] = rotl(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);

    let a = H0, b = H1, c = H2, d = H3, e = H4;

    for (let i = 0; i < 80; i++) {
      let temp;
      if (i < 20)       temp = (rotl(a, 5) + ((b & c) | (~b & d)) + e + W[i] + 0x5A827999) & 0xffffffff;
      else if (i < 40) temp = (rotl(a, 5) + (b ^ c ^ d) + e + W[i] + 0x6ED9EBA1) & 0xffffffff;
      else if (i < 60) temp = (rotl(a, 5) + ((b & c) | (b & d) | (c & d)) + e + W[i] + 0x8F1BBCDC) & 0xffffffff;
      else             temp = (rotl(a, 5) + (b ^ c ^ d) + e + W[i] + 0xCA62C1D6) & 0xffffffff;
      e = d; d = c; c = rotl(b, 30); b = a; a = temp;
    }

    H0 = (H0 + a) & 0xffffffff;
    H1 = (H1 + b) & 0xffffffff;
    H2 = (H2 + c) & 0xffffffff;
    H3 = (H3 + d) & 0xffffffff;
    H4 = (H4 + e) & 0xffffffff;
  }

  return tohex(H0) + tohex(H1) + tohex(H2) + tohex(H3) + tohex(H4);
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
function getSetting(key) {
  try {
    const val = settingsStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return settingsStorage.getItem(key) || null;
  }
}

function setSetting(key, value) {
  settingsStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

// ─── Token management ─────────────────────────────────────────────────────────
function loadCachedToken() {
  const token = getSetting('slnet_token');
  const expiry = getSetting('slnet_expiry');
  if (token && expiry && Date.now() < Number(expiry)) {
    cachedToken = token;
    tokenExpiry = Number(expiry);
    return true;
  }
  return false;
}

function saveCachedToken(token) {
  cachedToken = token;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;
  setSetting('slnet_token', token);
  setSetting('slnet_expiry', String(tokenExpiry));
}

function clearToken() {
  cachedToken = null;
  tokenExpiry = 0;
  settingsStorage.removeItem('slnet_token');
  settingsStorage.removeItem('slnet_expiry');
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function fetchJson(url, options) {
  const res = await fetch({ url, ...options });
  const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  return body;
}

// fetchWithCookie parses Set-Cookie header to extract slnet value
async function fetchWithCookie(url, options) {
  const res = await fetch({ url, ...options });
  const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  // Extract slnet from Set-Cookie header
  const cookieHeader = (res.headers && (res.headers['Set-Cookie'] || res.headers['set-cookie'])) || '';
  const match = cookieHeader.match(/slnet=([^;]+)/);
  if (match) {
    body.slnet = match[1];
  }
  return body;
}

// ─── StarLine 3-step auth ─────────────────────────────────────────────────────
async function authenticate() {
  const appId = getSetting('app_id');
  const secret = getSetting('secret_key');
  const login = getSetting('email');
  const password = getSetting('password');

  if (!appId || !secret || !login || !password) {
    throw new Error('Не заполнены учётные данные в настройках');
  }

  // Step 1: Get application token
  const step1Res = await fetchJson(
    `${ID_BASE}/application/getToken?appId=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`,
    { method: 'GET' }
  );
  if (!step1Res || step1Res.state !== 1) {
    throw new Error('Шаг 1: не удалось получить app token. Проверьте AppID и Secret');
  }
  const appToken = step1Res.desc.token;

  // Step 2: User login (password must be SHA1-hashed per StarLine API spec)
  const step2Res = await fetchJson(`${ID_BASE}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': appToken },
    body: JSON.stringify({ login, pass: sha1(password) }),
  });
  if (!step2Res || step2Res.state !== 1) {
    throw new Error('Шаг 2: ошибка входа. Проверьте email и пароль');
  }
  const userToken = step2Res.desc.user_token;

  // Step 3: Authenticate with dev.starline.ru — returns slnet cookie
  const step3Res = await fetchWithCookie(`${DEV_BASE}/auth.slid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': userToken,
    },
    body: JSON.stringify({}),
  });
  if (!step3Res || !step3Res.slnet) {
    throw new Error('Шаг 3: не удалось получить сессионный токен');
  }

  saveCachedToken(step3Res.slnet);
  return step3Res.slnet;
}

// ─── Get valid token (uses cache or re-auths) ─────────────────────────────────
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  if (loadCachedToken()) return cachedToken;
  return authenticate();
}

async function apiRequest(path, body, method = 'POST') {
  let token = await getToken();

  const doRequest = async (slnet) => {
    return fetchJson(`${DEV_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `slnet=${slnet}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doRequest(token);

  // On code 2 (session expired) — re-authenticate once
  if (res && (res.code === 2 || res.code === 401)) {
    clearToken();
    token = await authenticate();
    res = await doRequest(token);
  }

  return res;
}

// ─── StarLine commands ────────────────────────────────────────────────────────
async function getDeviceStatus() {
  const deviceId = getSetting('device_id');
  if (!deviceId) throw new Error('Не выбрано устройство. Откройте Настройки');

  const now = Date.now();
  if (cachedStatus && (now - lastStatusTime) < MIN_STATUS_INTERVAL_MS) {
    return cachedStatus;
  }

  const res = await apiRequest(`/device/${deviceId}/common_info`, null, 'GET');
  if (!res || res.code !== 0) throw new Error('Ошибка получения статуса устройства');

  const info = res.desc || {};
  cachedStatus = {
    engine: info.engine_state === 1,
    alarm: info.alarm_state === 1,
    temp: info.temp !== undefined ? Math.round(info.temp) : null,
    battery: info.battery_vol,
    balance: info.balance,
  };
  lastStatusTime = now;
  return cachedStatus;
}

async function sendDeviceCommand(cmd, value) {
  const deviceId = getSetting('device_id');
  if (!deviceId) throw new Error('Не выбрано устройство. Откройте Настройки');

  const body = { [cmd]: value };
  if (cmd === 'r_start' && value === 1) {
    const warmup = Number(getSetting('warmup_time') || 10);
    body.r_timer = warmup;
  }

  const res = await apiRequest(`/device/${deviceId}/set_param`, body);
  if (!res || res.code !== 0) {
    throw new Error((res && res.desc) ? res.desc : 'Команда не выполнена');
  }

  // Invalidate cache so next status fetch is fresh
  lastStatusTime = 0;
  cachedStatus = null;

  // Return updated status after short delay to let car process command
  await new Promise(r => setTimeout(r, 3000));
  return getDeviceStatus();
}

async function getDeviceList() {
  const res = await apiRequest('/user/devices', null, 'GET');
  if (!res || res.code !== 0) throw new Error('Ошибка получения списка устройств');
  return res.desc || [];
}

// ─── Settings listener — react to login/device-select actions ────────────────
settingsStorage.addListener('change', async ({ key, newValue }) => {
  if (key === 'action') {
    let val;
    try { val = JSON.parse(newValue); } catch { val = newValue; }

    if (val === 'login') {
      try {
        clearToken();
        await authenticate();
        const devices = await getDeviceList();
        setSetting('device_list', JSON.stringify(devices));
        setSetting('action_result', JSON.stringify({ ok: true }));
      } catch (e) {
        setSetting('action_result', JSON.stringify({ ok: false, error: e.message }));
      }
      settingsStorage.removeItem('action');
    }
  }
});

// ─── Side Service lifecycle ───────────────────────────────────────────────────
AppSideService({
  onInit() {
    messageBuilder.listen(() => {});

    messageBuilder.on('request', async (ctx) => {
      const { cmd, value } = messageBuilder.buf2Json(ctx.request.payload) || {};

      try {
        switch (cmd) {
          case 'get_status': {
            const status = await getDeviceStatus();
            ctx.response({ data: { code: 0, data: status } });
            break;
          }
          case 'r_start':
          case 'alarm': {
            const status = await sendDeviceCommand(cmd, value);
            ctx.response({ data: { code: 0, data: status } });
            break;
          }
          default:
            ctx.response({ data: { code: 1, message: 'Неизвестная команда: ' + cmd } });
        }
      } catch (e) {
        ctx.response({ data: { code: 1, message: e.message || 'Внутренняя ошибка' } });
      }
    });

    loadCachedToken();
  },

  onRun() {},

  onDestroy() {},
});
