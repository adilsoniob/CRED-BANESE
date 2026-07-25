const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../database');

// ─── Config ────────────────────────────────────────────────────────────────
const PANEL_BASE_URL   = (process.env.PANEL_BASE_URL || 'https://msg.topying.net').replace(/\/+$/, '');
const PANEL_TIMEOUT_MS = parseInt(process.env.PANEL_TIMEOUT_MS || '20000', 10);
const MAX_RETRIES      = 3;
const MAX_SEND_RETRIES = 2;
const HEARTBEAT_INTERVAL_MS = 300000; // 5 minutos (era 30s)
const QUEUE_FLUSH_INTERVAL_MS = 1000;

// ─── Internal state ────────────────────────────────────────────────────────
const accounts = [];           // [{ id, label, username, password, active, session, cookieJar, lastUsed, failCount, healthy, lastConnection, sentToday, sentThisMonth, lastSendTime, lastVerifiedTime }]
let currentIndex = 0;          // round‑robin index
let heartbeatTimer = null;
let queueTimer = null;
let dailyResetTimer = null;
const sendQueue = [];          // pending messages
const processing = new Set();  // clientId currently being processed
let currentDay = new Date().getDate();

// ─── Logger helpers ────────────────────────────────────────────────────────
const LOG = {
  info(tag, msg, extra) {
    const line = `[sms-panel] [${tag}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
    console.log(line);
    _writeLog(tag, 'info', msg, extra);
  },
  warn(tag, msg, extra) {
    const line = `[sms-panel] [${tag}] ⚠ ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
    console.warn(line);
    _writeLog(tag, 'warn', msg, extra);
  },
  error(tag, msg, extra) {
    const line = `[sms-panel] [${tag}] 🔴 ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
    console.error(line);
    _writeLog(tag, 'error', msg, extra);
  }
};

function _writeLog(tag, level, msg, extra) {
  try {
    const { v4: uid } = require('uuid');
    const details = JSON.stringify({ tag, level, msg, extra, timestamp: new Date().toISOString() });
    run(`INSERT INTO logs (id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [uid(), 'sms_' + level, 'sms_panel', tag, details.substring(0, 1000)]);
  } catch (e) { /* silent */ }
}

// ─── HTTP helper ───────────────────────────────────────────────────────────
function _httpRequest(method, path, body, cookieJar) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(PANEL_BASE_URL + path);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;

    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      timeout: PANEL_TIMEOUT_MS,
      headers: {
        'User-Agent': 'CredVale-SMS/1.0',
        'Accept': 'application/json, text/plain, */*',
      }
    };

    if (body) {
      const isForm = typeof body === 'string';
      const data = isForm ? body : JSON.stringify(body);
      opts.headers['Content-Type'] = isForm ? 'application/x-www-form-urlencoded' : 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }

    if (cookieJar && cookieJar.length) {
      opts.headers['Cookie'] = cookieJar.join('; ');
    }

    const req = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        const setCookie = res.headers['set-cookie'];
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text,
          setCookie: setCookie ? (Array.isArray(setCookie) ? setCookie : [setCookie]) : null,
        });
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── Cookie helpers ────────────────────────────────────────────────────────
function parseSetCookie(setCookieHeaders) {
  if (!setCookieHeaders || !setCookieHeaders.length) return [];
  return setCookieHeaders.map((c) => c.split(';')[0].trim());
}

function mergeCookies(existing, newCookies) {
  const map = {};
  for (const c of (existing || [])) { const k = c.split('=')[0]; map[k] = c; }
  for (const c of newCookies) { const k = c.split('=')[0]; map[k] = c; }
  return Object.values(map);
}

// ─── DB schema migration ───────────────────────────────────────────────────
function ensureSchema() {
  try {
    run(`
      CREATE TABLE IF NOT EXISTS sms_accounts (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        last_connection TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {}
}

// ─── Account loader ────────────────────────────────────────────────────────
function loadAccounts() {
  accounts.length = 0;
  ensureSchema();

  // Load from DB
  const dbRows = all('SELECT * FROM sms_accounts ORDER BY created_at ASC');
  for (const row of dbRows) {
    accounts.push({
      id: row.id,
      label: row.label,
      username: row.username,
      password: row.password,
      active: row.active === 1 || row.active === true,
      session: null,
      cookieJar: [],
      lastUsed: 0,
      failCount: 0,
      healthy: false,
      lastConnection: row.last_connection || '',
      sentToday: 0,
      sentThisMonth: 0,
      lastSendTime: '',
      lastVerifiedTime: '',
      fromDb: true,
    });
  }

  // Load from env vars (backward compatibility)
  const env = process.env;
  const a1 = { id: uuidv4(), label: 'Conta 1', username: env.SMS_ACCOUNT_1 || '', password: env.SMS_PASSWORD_1 || '', active: true, session: null, cookieJar: [], lastUsed: 0, failCount: 0, healthy: false, lastConnection: '', sentToday: 0, sentThisMonth: 0, lastSendTime: '', lastVerifiedTime: '', fromDb: false };
  if (a1.password) {
    if (!accounts.find(a => a.username === a1.username)) accounts.push(a1);
  }
  for (let i = 2; i <= 4; i++) {
    const u = env[`SMS_ACCOUNT_${i}`];
    const p = env[`SMS_PASSWORD_${i}`];
    if (u && p) {
      if (!accounts.find(a => a.username === u)) {
        accounts.push({ id: uuidv4(), label: `Conta ${i}`, username: u, password: p, active: true, session: null, cookieJar: [], lastUsed: 0, failCount: 0, healthy: false, lastConnection: '', sentToday: 0, sentThisMonth: 0, lastSendTime: '', lastVerifiedTime: '', fromDb: false });
      }
    }
  }

  LOG.info('load_accounts', `${accounts.length} conta(s) carregada(s)`, { count: accounts.length, labels: accounts.map(a => a.label) });
}

// ─── Session management ────────────────────────────────────────────────────
async function login(account) {
  const start = Date.now();
  LOG.info('login_start', `Autenticando ${account.label}...`, { username: _mask(account.username) });

  try {
    // Step 1: GET /login to get session cookie
    const page = await _httpRequest('GET', '/login', null, []);
    let jar = parseSetCookie(page.setCookie);
    if (!jar.length) throw new Error('Não foi possível obter cookie de sessão');

    // Step 2: POST /loadPuk to get RSA public key
    const pukResp = await _httpRequest('POST', '/loadPuk', null, jar);
    const pukData = JSON.parse(pukResp.text);
    if (pukData.state !== 0) throw new Error('Falha ao carregar chave RSA: ' + (pukData.message || 'state != 0'));

    // Step 3: RSA encrypt password
    const pem = '-----BEGIN PUBLIC KEY-----\n' + pukData.data.match(/.{1,64}/g).join('\n') + '\n-----END PUBLIC KEY-----';
    const encrypted = crypto.publicEncrypt(
      { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(account.password)
    ).toString('base64');

    // Step 4: POST /login with encrypted password
    const loginBody = 'username=' + encodeURIComponent(account.username) + '&pwd=' + encodeURIComponent(encrypted) + '&CSRF-TOKEN=';
    const loginResp = await _httpRequest('POST', '/login', loginBody, jar);
    if (loginResp.setCookie) {
      jar = mergeCookies(jar, parseSetCookie(loginResp.setCookie));
    }

    // Step 5: Check for redirect (success)
    if (loginResp.status >= 300 && loginResp.status < 400 && loginResp.headers.location) {
      // Follow redirect to fully establish session
      const idxResp = await _httpRequest('GET', loginResp.headers.location, null, jar);
      if (idxResp.setCookie) {
        jar = mergeCookies(jar, parseSetCookie(idxResp.setCookie));
      }
      account.cookieJar = jar;
      account.session = { loggedInAt: Date.now(), lastVerified: Date.now() };
      account.healthy = true;
      account.failCount = 0;
      account.lastConnection = new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (account.fromDb) {
        run("UPDATE sms_accounts SET last_connection = ?, updated_at = datetime('now') WHERE id = ?", [account.lastConnection, account.id]);
      }
      const elapsed = Date.now() - start;
      LOG.info('login_ok', `${account.label} autenticada`, { username: _mask(account.username), elapsed_ms: elapsed, cookies: jar.length });
      return true;
    }

    // Login returned page without redirect — check for error message
    const errMsg = (loginResp.text.match(/alertErrorTip\("([^"]+)"\)/) || ['', ''])[1];
    LOG.warn('login_failed', `${account.label} credenciais rejeitadas`, { username: _mask(account.username), status: loginResp.status, error: errMsg || 'unknown', response: _truncate(loginResp.text, 100) });
    account.healthy = false;
    account.failCount++;
    return false;
  } catch (err) {
    const elapsed = Date.now() - start;
    LOG.error('login_error', `${account.label} erro de conexão`, { username: _mask(account.username), error: err.message, elapsed_ms: elapsed });
    account.healthy = false;
    account.failCount++;
    return false;
  }
}

async function verifySession(account) {
  if (!account.session) return false;
  if (!account.cookieJar || !account.cookieJar.length) return false;

  try {
    // Check session by calling a protected AJAX endpoint
    const resp = await _httpRequest('POST', '/sendSms/sendSmsShortcut/getView.ajax', '', account.cookieJar);
    if (resp.status === 200) {
      try {
        const j = JSON.parse(resp.text);
        if (j && j.data) {
          account.session.lastVerified = Date.now();
          account.lastVerifiedTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
          return true;
        }
      } catch (_) {}
    }
    if (resp.status === 302 || resp.status === 401 || resp.status === 403) return false;
    return false;
  } catch (err) {
    return false;
  }
}

async function ensureSession(account) {
  if (account.session && account.cookieJar.length) {
    const valid = await verifySession(account);
    if (valid) {
      LOG.info('session_reused', `${account.label} sessão reutilizada`, { username: _mask(account.username) });
      return true;
    }
    LOG.info('session_expired', `${account.label} sessão expirada, renovando...`, { username: _mask(account.username) });
    account.session = null;
    account.cookieJar = [];
  }

  if (account.failCount > 3) {
    const backoffMs = Math.min(60000 * Math.pow(2, account.failCount - 3), 600000);
    if (Date.now() - account.lastUsed < backoffMs) {
      LOG.warn('session_backoff', `${account.label} em backoff (${backoffMs}ms)`, { failCount: account.failCount });
      return false;
    }
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    const ok = await login(account);
    if (ok) return true;
    LOG.warn('session_retry', `${account.label} tentativa ${attempt}/3 falhou`, {});
    if (attempt < 3) await _sleep(2000 * attempt);
  }

  account.healthy = false;
  return false;
}

// ─── SMS send via panel ────────────────────────────────────────────────────
async function sendViaPanel(account, phone, message) {
  let p = phone.replace(/\D/g, '');
  if (p.length <= 11) p = '55' + p;

  try {
    // Step 1: Get CSRF token
    const tokenResp = await _httpRequest('POST', '/loadSessionToken', '', account.cookieJar);
    if (tokenResp.status !== 200) {
      return { success: false, error: { status: tokenResp.status, body: _truncate(tokenResp.text, 200), endpoint: '/loadSessionToken' } };
    }
    let token = '';
    try {
      const j = JSON.parse(tokenResp.text);
      token = j.message || '';
    } catch (_) {
      return { success: false, error: { error: 'Falha ao parsear token', body: _truncate(tokenResp.text, 200) } };
    }
    if (!token) {
      return { success: false, error: { error: 'Token vazio' } };
    }

    // Step 2: Send SMS
    const params = 'number=' + encodeURIComponent(p) +
      '&sms=' + encodeURIComponent(message) +
      '&smstype=0' +
      '&token=' + encodeURIComponent(token);
    const sendResp = await _httpRequest('POST', '/sendSms/sendSmsShortcut/save.ajax', params, account.cookieJar);

    if (sendResp.status === 200) {
      let state = null;
      try {
        const j = JSON.parse(sendResp.text);
        state = j.state;
        if (j.state === 0 || j.state === 200) {
          return { success: true, status: sendResp.status, response: j.message || 'OK' };
        }
      } catch (_) {
        // Empty response (content-length: 0) also considered success
        if (!sendResp.text || sendResp.text.trim() === '') {
          return { success: true, status: sendResp.status, response: 'OK (empty)' };
        }
      }
      return { success: false, error: { status: sendResp.status, body: _truncate(sendResp.text, 200), state } };
    }

    if (sendResp.status === 302) {
      return { success: false, error: { status: 302, body: 'Sessão expirada', endpoint: '/sendSms/sendSmsShortcut/save.ajax' } };
    }

    return { success: false, error: { status: sendResp.status, body: _truncate(sendResp.text, 200), endpoint: '/sendSms/sendSmsShortcut/save.ajax' } };
  } catch (err) {
    return { success: false, error: { error: err.message } };
  }
}

// ─── Pick enabled + healthy account (round-robin) ──────────────────────────
async function _pickEnabledHealthyAccount() {
  // Only consider accounts that are active (enabled) and have credentials
  const enabled = accounts.filter(a => a.active && a.password);

  if (enabled.length === 0) {
    LOG.warn('pick_no_enabled', 'Nenhuma conta habilitada para envio');
    return null;
  }

  // Round-robin through enabled accounts
  for (let i = 0; i < enabled.length; i++) {
    const idx = (currentIndex + i) % enabled.length;
    const acc = enabled[idx];
    if (acc.healthy && acc.session) {
      currentIndex = (idx + 1) % enabled.length;
      return acc;
    }
  }

  // No healthy enabled account found — try to reconnect each one
  for (let i = 0; i < enabled.length; i++) {
    const idx = (currentIndex + i) % enabled.length;
    const acc = enabled[idx];
    LOG.info('pick_reconnect', `Tentando reconectar ${acc.label}...`, {});
    const authed = await ensureSession(acc);
    if (authed) {
      currentIndex = (idx + 1) % enabled.length;
      return acc;
    }
  }

  LOG.error('pick_no_account', 'Nenhuma conta habilitada disponível após tentar reconectar');
  return null;
}

// ─── Send with full retry + session validation ────────────────────────────
async function sendSms(phone, message, clientId, tipo) {
  const start = Date.now();
  const logMeta = { phone: _maskPhone(phone), clientId, tipo };
  LOG.info('send_start', 'Iniciando envio de SMS', logMeta);

  for (let attempt = 1; attempt <= MAX_SEND_RETRIES; attempt++) {
    // Step 1: Pick an enabled+healthy account
    const account = await _pickEnabledHealthyAccount();
    if (!account) {
      LOG.error('send_no_account', 'Nenhuma conta disponível', { attempt, ...logMeta });
      if (attempt < MAX_SEND_RETRIES) { await _sleep(3000 * attempt); continue; }
      break;
    }

    // Step 2: Validate session before sending — auto-reconnect if expired
    const sessionOk = await ensureSession(account);
    if (!sessionOk) {
      LOG.warn('send_auth_fail', `${account.label} não autenticou`, { attempt, ...logMeta });
      account.healthy = false;
      if (attempt < MAX_SEND_RETRIES) { await _sleep(2000); continue; }
      break;
    }

    // Step 3: Send
    LOG.info('send_sending', `Enviando via ${account.label} (tentativa ${attempt})`, logMeta);
    const result = await sendViaPanel(account, phone, message);

    if (result.success) {
      const elapsed = Date.now() - start;
      LOG.info('send_ok', `SMS enviado via ${account.label}`, { ...logMeta, account: account.label, elapsed_ms: elapsed });
      _logHistory(clientId, tipo || 'Automático', message, 'enviado');
      _logSendDetail(account.label, phone, 'sucesso', elapsed, null);
      // Update counters
      account.sentToday = (account.sentToday || 0) + 1;
      account.sentThisMonth = (account.sentThisMonth || 0) + 1;
      account.lastSendTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
      account.lastUsed = Date.now();
      return true;
    }

    LOG.warn('send_fail', `SMS rejeitado via ${account.label}`, { ...logMeta, account: account.label, error: result.error, attempt });
    _logHistory(clientId, tipo || 'Automático', message, 'falhou');
    _logSendDetail(account.label, phone, 'falha', Date.now() - start, JSON.stringify(result.error));

    account.session = null;
    account.cookieJar = [];
    account.failCount++;

    if (attempt < MAX_SEND_RETRIES) await _sleep(2000 * attempt);
  }

  const elapsed = Date.now() - start;
  LOG.error('send_exhausted', `Todas as tentativas esgotadas`, { ...logMeta, elapsed_ms: elapsed });
  return false;
}

// ─── Detailed send log ─────────────────────────────────────────────────────
function _logSendDetail(accountLabel, phone, status, elapsedMs, errorMsg) {
  try {
    const id = require('uuid').v4();
    run(`INSERT INTO logs (id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, 'sms_send_detail', 'sms_envio', accountLabel,
       JSON.stringify({ conta: accountLabel, telefone: _maskPhone(phone), status, elapsed_ms: elapsedMs, erro: errorMsg || null })]);
  } catch (e) {}
}

function _logHistory(clientId, tipo, mensagem, status) {
  if (!clientId) return;
  try {
    const id = require('uuid').v4();
    run(`INSERT INTO sms_history (id, client_id, tipo, mensagem, status) VALUES (?, ?, ?, ?, ?)`,
      [id, clientId, tipo, mensagem.substring(0, 500), status || 'enviado']);
  } catch (e) {}
}

// ─── Queue system ──────────────────────────────────────────────────────────
function enqueueSms(phone, message, clientId, tipo) {
  return new Promise((resolve) => {
    sendQueue.push({ phone, message, clientId, tipo, resolve, createdAt: Date.now() });
  });
}

async function _processQueue() {
  while (sendQueue.length > 0) {
    const job = sendQueue.shift();
    if (!job) continue;

    const key = job.clientId || job.phone;
    if (processing.has(key)) {
      LOG.info('queue_dedup', `Pulando duplicata`, { phone: _maskPhone(job.phone), clientId: job.clientId });
      job.resolve(false);
      continue;
    }

    processing.add(key);
    try {
      const ok = await sendSms(job.phone, job.message, job.clientId, job.tipo);
      job.resolve(ok);
    } catch (err) {
      LOG.error('queue_error', 'Erro ao processar fila', { error: err.message, phone: _maskPhone(job.phone) });
      job.resolve(false);
    } finally {
      processing.delete(key);
    }
  }
}

function _startQueueFlusher() {
  if (queueTimer) clearInterval(queueTimer);
  queueTimer = setInterval(_processQueue, QUEUE_FLUSH_INTERVAL_MS);
}

// ─── Heartbeat ─────────────────────────────────────────────────────────────
async function _heartbeat() {
  for (const account of accounts) {
    if (!account.active) {
      // Skip inactive accounts but keep them registered
      continue;
    }
    if (!account.session || !account.cookieJar.length) {
      if (account.password) {
        LOG.info('heartbeat_relogin', `Reconectando ${account.label}...`, {});
        const ok = await ensureSession(account);
        if (ok) LOG.info('heartbeat_relogin_ok', `${account.label} reconectada`, {});
        else LOG.warn('heartbeat_relogin_fail', `${account.label} falha na reconexão`, {});
      }
      continue;
    }
    const valid = await verifySession(account);
    if (valid) {
      account.session.lastVerified = Date.now();
      account.healthy = true;
    } else {
      LOG.warn('heartbeat_stale', `${account.label} sessão expirou`, {});
      account.session = null;
      account.cookieJar = [];
      account.healthy = false;
      const ok = await ensureSession(account);
      if (ok) LOG.info('heartbeat_renewed', `${account.label} sessão renovada`, {});
    }
  }
}

function _startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(_heartbeat, HEARTBEAT_INTERVAL_MS);
  LOG.info('heartbeat_start', `Heartbeat iniciado (intervalo: ${HEARTBEAT_INTERVAL_MS}ms)`, {});
}

// ─── Daily counter reset ────────────────────────────────────────────────────
function _checkDailyReset() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  if (day !== currentDay) {
    currentDay = day;
    for (const acc of accounts) {
      acc.sentToday = 0;
      if (month !== now.getMonth()) acc.sentThisMonth = 0;
    }
    LOG.info('daily_reset', 'Contadores diários resetados', {});
  }
}

function _startDailyReset() {
  if (dailyResetTimer) clearInterval(dailyResetTimer);
  dailyResetTimer = setInterval(_checkDailyReset, 60000);
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function _mask(str) {
  if (!str || str.length < 4) return str;
  return str.slice(0, 2) + '****' + str.slice(-2);
}

function _maskPhone(phone) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length < 4) return d;
  return d.slice(0, 2) + '****' + d.slice(-2);
}

function _truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Public API ────────────────────────────────────────────────────────────

async function init() {
  loadAccounts();
  if (accounts.length === 0) {
    LOG.warn('init', 'Nenhuma conta configurada nas variáveis de ambiente ou banco de dados', {});
    _startQueueFlusher();
    _startDailyReset();
    return;
  }

  LOG.info('init', `Iniciando login em ${accounts.length} conta(s)...`, {});
  for (const acc of accounts) {
    if (acc.active) {
      await ensureSession(acc);
      await _sleep(1000);
    }
  }

  _startHeartbeat();
  _startQueueFlusher();
  _startDailyReset();

  LOG.info('init_ok', `SMS Panel service iniciado`, { healthy: accounts.filter(a => a.healthy).length, total: accounts.length });
}

async function shutdown() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (queueTimer) clearInterval(queueTimer);
  LOG.info('shutdown', 'SMS Panel service encerrado', {});
}

async function send(phone, message, clientId, tipo) {
  if (accounts.length === 0) {
    LOG.error('send_no_accounts', 'Nenhuma conta configurada para envio', {});
    return false;
  }
  return enqueueSms(phone, message, clientId, tipo);
}

function getStatus() {
  _checkDailyReset();
  return {
    accounts: accounts.map(a => ({
      id: a.id,
      label: a.label,
      username: _mask(a.username),
      active: a.active,
      healthy: a.healthy,
      hasSession: !!a.session,
      failCount: a.failCount,
      lastConnection: a.lastConnection || '',
      lastVerifiedTime: a.lastVerifiedTime || '',
      lastSendTime: a.lastSendTime || '',
      sentToday: a.sentToday || 0,
      sentThisMonth: a.sentThisMonth || 0,
    })),
    queueSize: sendQueue.length,
    processingCount: processing.size,
  };
}

// ─── Account management ────────────────────────────────────────────────────

function getAccounts() {
  _checkDailyReset();
  return accounts.map(a => ({
    id: a.id,
    label: a.label,
    username: a.username,
    maskedUsername: _mask(a.username),
    active: a.active,
    healthy: a.healthy,
    hasSession: !!a.session,
    failCount: a.failCount,
    lastConnection: a.lastConnection || '',
    lastVerifiedTime: a.lastVerifiedTime || '',
    lastSendTime: a.lastSendTime || '',
    sentToday: a.sentToday || 0,
    sentThisMonth: a.sentThisMonth || 0,
    fromDb: !!a.fromDb,
  }));
}

async function verifyAllAccounts() {
  const results = [];
  for (const acc of accounts) {
    const status = await ensureSession(acc);
    results.push({
      id: acc.id,
      label: acc.label,
      username: _mask(acc.username),
      connected: status,
      healthy: acc.healthy,
      lastConnection: acc.lastConnection || '',
    });
    // If account failed, remove from DB if it was from DB
    if (!status && acc.fromDb) {
      LOG.warn('verify_remove', `Removendo ${acc.label} — falha na autenticação`, {});
      try { run('DELETE FROM sms_accounts WHERE id = ?', [acc.id]); } catch (e) {}
    }
  }
  // Reload to reflect removals
  loadAccounts();
  return results;
}

async function addAccount(username, password, label) {
  const id = uuidv4();
  const lbl = label || username;
  // Save to DB
  run('INSERT INTO sms_accounts (id, label, username, password, active) VALUES (?, ?, ?, ?, 1)', [id, lbl, username, password]);

  // Add to runtime
  const acc = { id, label: lbl, username, password, active: true, session: null, cookieJar: [], lastUsed: 0, failCount: 0, healthy: false, lastConnection: '', fromDb: true };
  accounts.push(acc);

  // Try to connect
  const ok = await ensureSession(acc);
  LOG.info('add_account', `Conta ${lbl} adicionada`, { username: _mask(username), connected: ok });
  return { id, label: lbl, connected: ok };
}

function removeAccount(id) {
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) return false;
  const acc = accounts[idx];
  if (acc.fromDb) {
    try { run('DELETE FROM sms_accounts WHERE id = ?', [id]); } catch (e) {}
  }
  accounts.splice(idx, 1);
  LOG.info('remove_account', `Conta ${acc.label} removida`, {});
  return true;
}

function toggleAccountActive(id, active) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return false;
  acc.active = active;
  if (acc.fromDb) {
    try { run('UPDATE sms_accounts SET active = ?, updated_at = datetime("now") WHERE id = ?', [active ? 1 : 0, id]); } catch (e) {}
  }
  if (!active) {
    acc.session = null;
    acc.cookieJar = [];
    acc.healthy = false;
  }
  LOG.info('toggle_account', `Conta ${acc.label} ${active ? 'ativada' : 'desativada'}`, {});
  return true;
}

async function connectAccount(id) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return { success: false, error: 'Conta não encontrada' };
  const ok = await ensureSession(acc);
  return { success: ok, label: acc.label, healthy: acc.healthy };
}

function disconnectAccount(id) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return false;
  acc.session = null;
  acc.cookieJar = [];
  acc.healthy = false;
  LOG.info('disconnect_account', `Conta ${acc.label} desconectada manualmente`, {});
  return true;
}

function getSendLogs(limit) {
  try {
    const rows = all(
      `SELECT details, created_at FROM logs WHERE action = 'sms_send_detail' ORDER BY created_at DESC LIMIT ?`,
      [limit || 100]
    );
    return rows.map(r => {
      let d = {};
      try { d = JSON.parse(r.details || '{}'); } catch (e) {}
      return {
        created_at: r.created_at,
        conta: d.conta || '',
        telefone: d.telefone || '',
        status: d.status || '',
        elapsed_ms: d.elapsed_ms || 0,
        erro: d.erro || null,
      };
    });
  } catch (e) { return []; }
}

module.exports = {
  init, shutdown, send, getStatus,
  getAccounts, verifyAllAccounts,
  addAccount, removeAccount,
  toggleAccountActive,
  connectAccount, disconnectAccount,
  getSendLogs,
};