import { MessageBuilder } from './shared/message-side';

// ─── StarLine API endpoints ───────────────────────────────────────────────────
const ID_BASE  = 'https://id.starline.ru/apiV3';
const API_BASE = 'https://developer.starline.ru';

// slnet token lifetime: 24 hours (per docs), using 23h to be safe
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

// Minimum interval between status requests (90 sec)
const MIN_STATUS_INTERVAL_MS = 90 * 1000;

const messageBuilder = new MessageBuilder();

let cachedToken  = null;
let tokenExpiry  = 0;
let lastStatusTime = 0;
let cachedStatus = null;

// ─── UTF-8 encoder (replaces deprecated unescape+encodeURIComponent) ──────────
function toUtf8(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) { out += str[i]; }
    else if (c < 2048) { out += String.fromCharCode((c >> 6) | 192, (c & 63) | 128); }
    else { out += String.fromCharCode((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128); }
  }
  return out;
}

// ─── SHA1 helper (password hashing for /user/login) ───────────────────────────
function sha1(str) {
  function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
  function tohex(n) {
    let s = '';
    for (let i = 7; i >= 0; i--) s += ((n >>> (i * 4)) & 0xf).toString(16);
    return s;
  }

  const msg = toUtf8(str);
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
      if (i < 20)      temp = (rotl(a, 5) + ((b & c) | (~b & d)) + e + W[i] + 0x5A827999) & 0xffffffff;
      else if (i < 40) temp = (rotl(a, 5) + (b ^ c ^ d) + e + W[i] + 0x6ED9EBA1) & 0xffffffff;
      else if (i < 60) temp = (rotl(a, 5) + ((b & c) | (b & d) | (c & d)) + e + W[i] + 0x8F1BBCDC) & 0xffffffff;
      else             temp = (rotl(a, 5) + (b ^ c ^ d) + e + W[i] + 0xCA62C1D6) & 0xffffffff;
      e = d; d = c; c = rotl(b, 30); b = a; a = temp;
    }
    H0 = (H0 + a) & 0xffffffff; H1 = (H1 + b) & 0xffffffff;
    H2 = (H2 + c) & 0xffffffff; H3 = (H3 + d) & 0xffffffff; H4 = (H4 + e) & 0xffffffff;
  }
  return tohex(H0) + tohex(H1) + tohex(H2) + tohex(H3) + tohex(H4);
}

// ─── MD5 helper (app token flow: secret hashing) ─────────────────────────────
function md5(str) {
  function safeAdd(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
  }
  function rol(n, s) { return (n << s) | (n >>> (32 - s)); }
  function cmn(q, a, b, x, s, t) { return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

  const bytes = toUtf8(str);
  const n = bytes.length;
  const nBlocks = (n + 8 >> 6) + 1;
  const M = [];
  for (let i = 0; i < nBlocks * 16; i++) M[i] = 0;
  for (let i = 0; i < n; i++) M[i >> 2] |= bytes.charCodeAt(i) << (i % 4 * 8);
  M[n >> 2] |= 0x80 << (n % 4 * 8);
  M[nBlocks * 16 - 2] = n * 8;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let i = 0; i < M.length; i += 16) {
    const A = a, B = b, C = c, D = d;
    a=ff(a,b,c,d,M[i+0], 7,-680876936);  d=ff(d,a,b,c,M[i+1],12,-389564586);
    c=ff(c,d,a,b,M[i+2],17, 606105819);  b=ff(b,c,d,a,M[i+3],22,-1044525330);
    a=ff(a,b,c,d,M[i+4], 7,-176418897);  d=ff(d,a,b,c,M[i+5],12,1200080426);
    c=ff(c,d,a,b,M[i+6],17,-1473231341); b=ff(b,c,d,a,M[i+7],22,-45705983);
    a=ff(a,b,c,d,M[i+8], 7,1770035416);  d=ff(d,a,b,c,M[i+9],12,-1958414417);
    c=ff(c,d,a,b,M[i+10],17,-42063);      b=ff(b,c,d,a,M[i+11],22,-1990404162);
    a=ff(a,b,c,d,M[i+12],7,1804603682);  d=ff(d,a,b,c,M[i+13],12,-40341101);
    c=ff(c,d,a,b,M[i+14],17,-1502002290);b=ff(b,c,d,a,M[i+15],22,1236535329);
    a=gg(a,b,c,d,M[i+1], 5,-165796510);  d=gg(d,a,b,c,M[i+6], 9,-1069501632);
    c=gg(c,d,a,b,M[i+11],14,643717713);  b=gg(b,c,d,a,M[i+0],20,-373897302);
    a=gg(a,b,c,d,M[i+5], 5,-701558691);  d=gg(d,a,b,c,M[i+10],9,38016083);
    c=gg(c,d,a,b,M[i+15],14,-660478335); b=gg(b,c,d,a,M[i+4],20,-405537848);
    a=gg(a,b,c,d,M[i+9], 5,568446438);   d=gg(d,a,b,c,M[i+14],9,-1019803690);
    c=gg(c,d,a,b,M[i+3],14,-187363961);  b=gg(b,c,d,a,M[i+8],20,1163531501);
    a=gg(a,b,c,d,M[i+13],5,-1444681467); d=gg(d,a,b,c,M[i+2], 9,-51403784);
    c=gg(c,d,a,b,M[i+7],14,1735328473);  b=gg(b,c,d,a,M[i+12],20,-1926607734);
    a=hh(a,b,c,d,M[i+5], 4,-378558);     d=hh(d,a,b,c,M[i+8],11,-2022574463);
    c=hh(c,d,a,b,M[i+11],16,1839030562); b=hh(b,c,d,a,M[i+14],23,-35309556);
    a=hh(a,b,c,d,M[i+1], 4,-1530992060);d=hh(d,a,b,c,M[i+4],11,1272893353);
    c=hh(c,d,a,b,M[i+7],16,-155497632);  b=hh(b,c,d,a,M[i+10],23,-1094730640);
    a=hh(a,b,c,d,M[i+13],4,681279174);   d=hh(d,a,b,c,M[i+0],11,-358537222);
    c=hh(c,d,a,b,M[i+3],16,-722521979);  b=hh(b,c,d,a,M[i+6],23,76029189);
    a=hh(a,b,c,d,M[i+9], 4,-640364487);  d=hh(d,a,b,c,M[i+12],11,-421815835);
    c=hh(c,d,a,b,M[i+15],16,530742520);  b=hh(b,c,d,a,M[i+2],23,-995338651);
    a=ii(a,b,c,d,M[i+0], 6,-198630844);  d=ii(d,a,b,c,M[i+7],10,1126891415);
    c=ii(c,d,a,b,M[i+14],15,-1416354905);b=ii(b,c,d,a,M[i+5],21,-57434055);
    a=ii(a,b,c,d,M[i+12],6,1700485571);  d=ii(d,a,b,c,M[i+3],10,-1894986606);
    c=ii(c,d,a,b,M[i+10],15,-1051523);   b=ii(b,c,d,a,M[i+1],21,-2054922799);
    a=ii(a,b,c,d,M[i+8], 6,1873313359);  d=ii(d,a,b,c,M[i+15],10,-30611744);
    c=ii(c,d,a,b,M[i+6],15,-1560198380); b=ii(b,c,d,a,M[i+13],21,1309151649);
    a=ii(a,b,c,d,M[i+4], 6,-145523070);  d=ii(d,a,b,c,M[i+11],10,-1120210379);
    c=ii(c,d,a,b,M[i+2],15,718787259);   b=ii(b,c,d,a,M[i+9],21,-343485551);
    a=safeAdd(a,A); b=safeAdd(b,B); c=safeAdd(c,C); d=safeAdd(d,D);
  }
  function hexLE(n) {
    let s = '';
    for (let j = 0; j < 4; j++) s += ('0' + ((n >>> (j * 8)) & 0xff).toString(16)).slice(-2);
    return s;
  }
  return hexLE(a) + hexLE(b) + hexLE(c) + hexLE(d);
}

// ─── Event logger (writes timestamped entries to _log in settingsStorage) ─────
const MAX_LOG = 50;

function writeLog(msg, isError = false) {
  try {
    const now = new Date();
    const ts = ('0' + now.getHours()).slice(-2) + ':' +
               ('0' + now.getMinutes()).slice(-2) + ':' +
               ('0' + now.getSeconds()).slice(-2);
    const prefix = isError ? '[ERR]' : '[OK] ';
    const entry = ts + ' ' + prefix + ' ' + msg;
    let logs = [];
    try {
      const stored = settings.settingsStorage.getItem('_log');
      if (stored) logs = JSON.parse(stored);
    } catch (e) {}
    logs.unshift(entry);
    if (logs.length > MAX_LOG) logs = logs.slice(0, MAX_LOG);
    settings.settingsStorage.setItem('_log', JSON.stringify(logs));
  } catch (e) {}
}

// ─── Encode object as application/x-www-form-urlencoded ──────────────────────
function encodeFormData(obj) {
  return Object.keys(obj)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
    .join('&');
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
function getSetting(key) {
  try {
    const val = settings.settingsStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    return settings.settingsStorage.getItem(key) || null;
  }
}

function setSetting(key, value) {
  settings.settingsStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
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
  settings.settingsStorage.removeItem('slnet_token');
  settings.settingsStorage.removeItem('slnet_expiry');
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function fetchJson(url, options) {
  const opts = options || {};
  const res = await fetch({
    url: url,
    method: opts.method || 'GET',
    headers: opts.headers,
    body: opts.body,
  });
  return typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
}

// Parses Set-Cookie header to extract slnet value and attaches it to the body
async function fetchWithCookie(url, options) {
  const opts = options || {};
  const res = await fetch({
    url: url,
    method: opts.method || 'GET',
    headers: opts.headers,
    body: opts.body,
  });
  const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  const cookieHeader = (res.headers && (res.headers['Set-Cookie'] || res.headers['set-cookie'])) || '';
  const match = cookieHeader.match(/slnet=([^;]+)/);
  if (match) body.slnet = match[1];
  return body;
}

// ─── StarLine 3-step auth ─────────────────────────────────────────────────────
// Step 1a: getCode  → MD5(secret)
// Step 1b: getToken → MD5(secret + code)
// Step 2:  user/login → form-urlencoded, SHA1(password)
// Step 3:  auth.slid → {slid_token: userToken} in body, returns slnet cookie
async function authenticate() {
  const appId    = settings.settingsStorage.getItem('app_id') || '';
  const secret   = settings.settingsStorage.getItem('secret_key') || '';
  const login    = settings.settingsStorage.getItem('email') || '';
  const password = settings.settingsStorage.getItem('password') || '';

  if (!appId || !secret || !login || !password) {
    const missing = ['app_id','secret_key','email','password'].filter(k => !getSetting(k));
    const err = 'Не заполнены поля: ' + missing.join(', ');
    writeLog(err, true);
    throw new Error(err);
  }
  writeLog('Авторизация: appId=' + appId + ' login=' + login);

  // Step 1a: Get application code (secret = MD5 of the raw secret key)
  writeLog('Шаг 1a: getCode...');
  let codeRes;
  try {
    codeRes = await fetchJson(
      `${ID_BASE}/application/getCode?appId=${encodeURIComponent(appId)}&secret=${encodeURIComponent(md5(secret))}`,
      { method: 'GET' }
    );
  } catch (e) {
    writeLog('getCode network error: ' + e.message, true);
    throw e;
  }
  writeLog('getCode response: state=' + (codeRes && codeRes.state) + ' desc=' + JSON.stringify(codeRes && codeRes.desc));
  if (!codeRes || codeRes.state !== 1) {
    const err = 'Шаг 1a: ' + JSON.stringify(codeRes && codeRes.desc);
    writeLog(err, true);
    throw new Error(err);
  }
  const appCode = codeRes.desc.code;

  // Step 1b: Get application token (secret = MD5 of secret + code)
  writeLog('Шаг 1b: getToken...');
  let tokenRes;
  try {
    tokenRes = await fetchJson(
      `${ID_BASE}/application/getToken?appId=${encodeURIComponent(appId)}&secret=${encodeURIComponent(md5(secret + appCode))}`,
      { method: 'GET' }
    );
  } catch (e) {
    writeLog('getToken network error: ' + e.message, true);
    throw e;
  }
  writeLog('getToken response: state=' + (tokenRes && tokenRes.state));
  if (!tokenRes || tokenRes.state !== 1) {
    const err = 'Шаг 1b: ' + JSON.stringify(tokenRes && tokenRes.desc);
    writeLog(err, true);
    throw new Error(err);
  }
  const appToken = tokenRes.desc.token;

  // Step 2: User login — MUST be application/x-www-form-urlencoded
  writeLog('Шаг 2: user/login...');
  let loginRes;
  try {
    loginRes = await fetchJson(`${ID_BASE}/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'token': appToken,
      },
      body: encodeFormData({ login, pass: sha1(password) }),
    });
  } catch (e) {
    writeLog('user/login network error: ' + e.message, true);
    throw e;
  }
  writeLog('user/login response: state=' + (loginRes && loginRes.state) + ' msg=' + JSON.stringify(loginRes && loginRes.desc && loginRes.desc.message));
  if (!loginRes || loginRes.state !== 1) {
    const msg = (loginRes && loginRes.desc && loginRes.desc.message) || JSON.stringify(loginRes);
    const err = 'Шаг 2: ' + msg;
    writeLog(err, true);
    throw new Error(err);
  }
  const userToken = loginRes.desc.user_token;

  // Step 3: Get slnet session cookie — slid_token in JSON body (NOT in header)
  writeLog('Шаг 3: auth.slid...');
  let authRes;
  try {
    authRes = await fetchWithCookie(`${API_BASE}/json/v2/auth.slid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slid_token: userToken }),
    });
  } catch (e) {
    writeLog('auth.slid network error: ' + e.message, true);
    throw e;
  }
  writeLog('auth.slid response: code=' + (authRes && authRes.code) + ' user_id=' + (authRes && authRes.user_id) + ' slnet=' + (authRes && authRes.slnet ? 'OK' : 'MISSING'));
  if (!authRes || authRes.code != 200) {
    const err = 'Шаг 3: code=' + (authRes && authRes.code) + ' ' + (authRes && authRes.codestring);
    writeLog(err, true);
    throw new Error(err);
  }
  if (!authRes.slnet) {
    const err = 'Шаг 3: slnet cookie не получен из Set-Cookie';
    writeLog(err, true);
    throw new Error(err);
  }

  // Store user_id — required for /json/v1/user/{user_id}/devices
  if (authRes.user_id) {
    setSetting('user_id', String(authRes.user_id));
    writeLog('user_id сохранён: ' + authRes.user_id);
  }

  saveCachedToken(authRes.slnet);
  writeLog('Авторизация успешна');
  return authRes.slnet;
}

// ─── Get valid token (uses cache or re-auths) ─────────────────────────────────
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  if (loadCachedToken()) return cachedToken;
  return authenticate();
}

// ─── Authenticated API request ────────────────────────────────────────────────
async function apiRequest(path, body, method = 'POST') {
  let token = await getToken();

  const doRequest = async (slnet) => fetchJson(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `slnet=${slnet}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let res = await doRequest(token);

  // 401 = session expired — re-authenticate once
  if (res && res.code == 401) {
    clearToken();
    token = await authenticate();
    res = await doRequest(token);
  }

  return res;
}

// ─── Get device status ────────────────────────────────────────────────────────
// Uses /json/v3/device/{id}/data (recommended endpoint per docs)
// Response structure: {code: 200, data: {common: {}, state: {}, balance: [], ...}}
async function getDeviceStatus() {
  const deviceId = getSetting('device_id');
  if (!deviceId) throw new Error('Не выбрано устройство. Откройте Настройки');

  const now = Date.now();
  if (cachedStatus && (now - lastStatusTime) < MIN_STATUS_INTERVAL_MS) {
    return cachedStatus;
  }

  writeLog('getStatus device=' + deviceId);
  const res = await apiRequest(`/json/v3/device/${deviceId}/data`, null, 'GET');
  writeLog('getStatus response: code=' + (res && res.code));
  if (!res || res.code != 200) {
    const err = 'Ошибка статуса: code=' + (res && res.code) + ' ' + (res && res.codestring);
    writeLog(err, true);
    throw new Error(err);
  }

  const d      = res.data  || {};
  const common = d.common  || {};
  const state  = d.state   || {};

  // balance is an array; pick the active SIM entry
  let balance = null;
  if (Array.isArray(d.balance) && d.balance.length > 0) {
    const active = d.balance.find(b => b.key === 'active') || d.balance[0];
    if (active && active.value !== undefined) balance = active.value;
  }

  cachedStatus = {
    engine:  !!state.r_start,  // remote start active
    alarm:   !!state.arm,       // охрана active
    etemp:   common.etemp   !== undefined ? common.etemp   : null,
    ctemp:   common.ctemp   !== undefined ? common.ctemp   : null,
    battery: common.battery !== undefined ? common.battery : null,
    balance,
    // widget visibility flags — compare to boolean false (getSetting returns boolean via JSON.parse)
    show_etemp:   getSetting('show_etemp')   !== false,
    show_battery: getSetting('show_battery') !== false,
    show_balance: getSetting('show_balance') !== false,
  };
  lastStatusTime = now;
  return cachedStatus;
}

// ─── Send device command ──────────────────────────────────────────────────────
// Uses /json/v1/device/{id}/set_param (only v1 exists per docs)
// Body MUST have: {type: "cmd_name", cmd_name: value}
async function sendDeviceCommand(cmd, value) {
  const deviceId = getSetting('device_id');
  if (!deviceId) throw new Error('Не выбрано устройство. Откройте Настройки');

  // Map internal command names to StarLine API set_param format
  let body;
  if (cmd === 'r_start') {
    // value=1 → start engine, value=0 → stop engine
    if (value === 1) {
      body = { type: 'ign_start', ign_start: 1 };
    } else {
      body = { type: 'ign_stop', ign_stop: 1 };
    }
  } else if (cmd === 'alarm') {
    // value=1 → arm (охрана), value=0 → disarm
    body = { type: 'arm', arm: value };
  } else {
    throw new Error('Неизвестная команда: ' + cmd);
  }

  writeLog('sendCmd device=' + deviceId + ' body=' + JSON.stringify(body));
  const res = await apiRequest(`/json/v1/device/${deviceId}/set_param`, body);
  writeLog('sendCmd response: code=' + (res && res.code) + ' type=' + (res && res.type));
  if (!res || res.code != 200) {
    const err = (res && res.codestring) ? res.codestring : 'Команда не выполнена';
    writeLog(err, true);
    throw new Error(err);
  }

  // Invalidate cache, wait for car to process command, then fetch fresh status
  lastStatusTime = 0;
  cachedStatus = null;
  await new Promise(r => setTimeout(r, 3000));
  return getDeviceStatus();
}

// ─── Get device list ──────────────────────────────────────────────────────────
// Requires user_id from auth step, response field is "devices" (not "desc")
async function getDeviceList() {
  const userId = getSetting('user_id');
  if (!userId) throw new Error('Не выполнен вход. Нажмите "Войти" в настройках');

  writeLog('getDeviceList user=' + userId);
  const res = await apiRequest(`/json/v1/user/${userId}/devices`, null, 'GET');
  writeLog('getDeviceList response: code=' + (res && res.code) + ' count=' + (res && res.devices && res.devices.length));
  if (!res || res.code != 200) {
    const err = 'Список устройств: code=' + (res && res.code) + ' ' + (res && res.codestring);
    writeLog(err, true);
    throw new Error(err);
  }
  return res.devices || [];
}

// ─── Side Service lifecycle ───────────────────────────────────────────────────
AppSideService({
  onInit() {
    writeLog('=== Side service запущен ===');

    // Settings listener MUST be registered inside onInit
    settings.settingsStorage.addListener('change', async ({ key, newValue }) => {
      if (key === 'action') {
        let val;
        try { val = JSON.parse(newValue); } catch (e) { val = newValue; }

        if (val === 'login') {
          writeLog('=== Запрос авторизации ===');
          try {
            clearToken();
            await authenticate();
            const devices = await getDeviceList();
            setSetting('device_list', JSON.stringify(devices));
            writeLog('Устройств найдено: ' + devices.length);
            setSetting('action_result', JSON.stringify({ ok: true }));
            writeLog('=== Вход выполнен успешно ===');
          } catch (e) {
            writeLog('=== Ошибка: ' + e.message + ' ===', true);
            setSetting('action_result', JSON.stringify({ ok: false, error: e.message }));
          }
          settings.settingsStorage.removeItem('action');
        }

        if (val === 'get_slnet') {
          // Settings page completed user/login and got slid_token via XHR.
          // Side-service now calls auth.slid to get the slnet cookie for watch commands.
          writeLog('=== get_slnet: auth.slid через side-service ===');
          try {
            const slidToken = getSetting('slid_token');
            if (!slidToken) throw new Error('slid_token не найден');
            const authRes = await fetchWithCookie(`${API_BASE}/json/v2/auth.slid`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slid_token: slidToken }),
            });
            writeLog('auth.slid code=' + authRes.code + ' slnet=' + (authRes.slnet ? 'OK' : 'MISSING'));
            if (authRes.code == 200 && authRes.slnet) {
              saveCachedToken(authRes.slnet);
              writeLog('slnet сохранён для команд часов');
            }
          } catch (e) {
            writeLog('get_slnet error: ' + e.message, true);
          }
          settings.settingsStorage.removeItem('action');
        }
      }
    });

    messageBuilder.listen(() => {});

    messageBuilder.on('request', async (ctx) => {
      const { cmd, value } = messageBuilder.buf2Json(ctx.request.payload) || {};
      writeLog('Запрос с часов: cmd=' + cmd);

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
