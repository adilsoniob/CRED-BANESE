const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../database');
const smsPanel = require('../services/sms-panel');
const {
  smsSendLimiter,
  smsVerifyLimiter,
  smsWriteLimiter,
  smsReadLimiter,
} = require('../middleware/rate-limiter');
// (auth temporariamente desabilitada)

const router = express.Router();

// Dashboard stats
router.get('/dashboard', (req, res) => {
  try {
    const totalClients = get('SELECT COUNT(*) as count FROM clients').count;
    const pendingClients = get('SELECT COUNT(*) as count FROM clients WHERE status = ?', ['pendente']).count;
    const approvedClients = get('SELECT COUNT(*) as count FROM clients WHERE status = ?', ['aprovado']).count;
    const activatedClients = get('SELECT COUNT(*) as count FROM clients WHERE status = ?', ['ativado']).count;
    const totalRequests = get('SELECT COUNT(*) as count FROM requests').count;
    const pendingRequests = get('SELECT COUNT(*) as count FROM requests WHERE status = ?', ['pendente']).count;
    const totalPayments = get('SELECT COUNT(*) as count FROM payments').count;
    const paidPayments = get('SELECT COUNT(*) as count FROM payments WHERE status = ?', ['pago']).count;
    const totalRevenue = get('SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = ?', ['pago']).total;
    const pixPayments = get('SELECT COUNT(*) as count FROM payments WHERE metodo = ? AND status = ?', ['pix', 'pago']).count;
    const cardPayments = get('SELECT COUNT(*) as count FROM payments WHERE metodo = ? AND status = ?', ['cartao', 'pago']).count;
    const conversionRate = totalClients > 0 ? ((activatedClients / totalClients) * 100).toFixed(1) : 0;

    const onlineAgora = get(`SELECT COUNT(*) as count FROM clients WHERE last_active_at >= datetime('now', '-5 minutes')`).count;
    const totalPixCopies = get(`SELECT COALESCE(SUM(pix_copied_count), 0) as total FROM clients`).total;
    const totalPushinpayClicks = get(`SELECT COALESCE(SUM(pushinpay_click_count), 0) as total FROM clients`).total;

    const supportClickRow = get(`SELECT value FROM settings WHERE key = 'support_click_count'`);
    const supportClickCount = parseInt(supportClickRow?.value || '0', 10);
    const pageViewCount = get('SELECT COUNT(*) as count FROM page_views').count;
    const totalClicks = (parseInt(totalPixCopies || 0) + parseInt(totalPushinpayClicks || 0) + parseInt(supportClickCount || 0));
    const monthlyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-30 days')`).total;
    const dailyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-1 day')`).total;
    const weeklyRevenue = get(`SELECT COALESCE(SUM(valor), 0) as total FROM payments WHERE status = 'pago' AND paid_at >= datetime('now', '-7 days')`).total;
    const expectativaReceita = monthlyRevenue;

    const onlineSessions = get(`SELECT COUNT(*) as count FROM sessions WHERE offline_at IS NULL AND last_heartbeat >= datetime('now', '-60 seconds')`).count;
    const onlineSessionList = all(`SELECT id, nome, cpf, stage, dispositivo, modelo, fabricante, navegador, navegador_versao, os, ip, origem, last_activity FROM sessions WHERE offline_at IS NULL AND last_heartbeat >= datetime('now', '-60 seconds') ORDER BY last_activity DESC`);

    const recentClients = all('SELECT id, cpf, nome, whatsapp, status, created_at, dispositivo, modelo, fabricante, os, navegador, navegador_versao FROM clients ORDER BY created_at DESC LIMIT 10');
    const recentPayments = all(`SELECT p.*, c.nome as client_nome FROM payments p JOIN clients c ON p.client_id = c.id ORDER BY p.created_at DESC LIMIT 10`);

    res.json({
      kpis: { totalClients, pendingClients, approvedClients, activatedClients, totalRequests, pendingRequests, totalPayments, paidPayments, totalRevenue, pixPayments, cardPayments, conversionRate, onlineAgora, onlineSessions, totalPixCopies, totalPushinpayClicks, supportClickCount, pageViewCount, totalClicks, expectativaReceita, dailyRevenue, weeklyRevenue, monthlyRevenue },
      onlineSessionList,
      recentClients, recentPayments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs
router.post('/logs', (req, res) => {
  try {
    const { action, entity, entity_id, details } = req.body;
    if (!action || !entity) return res.status(400).json({ error: 'action e entity são obrigatórios' });
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [req.user?.id || 'system', action, entity, entity_id || null, details || null, req.ip || null]);
    res.status(201).json({ message: 'Log registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', (req, res) => {
  try {
    const { action, entity, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    if (action) { where.push('l.action = ?'); params.push(action); }
    if (entity) { where.push('l.entity = ?'); params.push(entity); }
    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    params.push(Number(limit), Number(offset));
    const logs = all(`SELECT l.*, u.name as user_name FROM logs l LEFT JOIN users u ON l.user_id = u.id${whereClause} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, params);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications
router.get('/notifications', (req, res) => {
  try {
    const notifications = all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/:id/read', (req, res) => {
  try {
    run('UPDATE notifications SET lida = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notificação marcada como lida' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Users management
router.get('/users', (req, res) => {
  try {
    const users = all('SELECT id, email, name, login, role, permissions, active, nivel, telefone, ultimo_acesso, created_at FROM users ORDER BY created_at DESC');
    const permissoes = all('SELECT * FROM permissoes ORDER BY nome');
    res.json({ users, permissoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', (req, res) => {
  try {
    const { email, password, name, login, role, nivel, permissions, telefone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'E-mail, senha e nome são obrigatórios' });
    }
    const existing = get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const id = uuidv4();
    run('INSERT INTO users (id, email, password_hash, name, login, role, nivel, permissions, telefone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, email, hash, name, login || email, role || 'operador', nivel || 1, JSON.stringify(permissions || []), telefone || null]);
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_create', 'users', id, 'Criado: ' + name + ' (' + email + ')']);
    res.status(201).json({ id, message: 'Usuário criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', (req, res) => {
  try {
    const existing = get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { name, email, login, role, nivel, permissions, telefone, active } = req.body;
    if (name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', [name, req.params.id]);
    if (email !== undefined) run('UPDATE users SET email = ? WHERE id = ?', [email, req.params.id]);
    if (login !== undefined) run('UPDATE users SET login = ? WHERE id = ?', [login, req.params.id]);
    if (role !== undefined) run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    if (nivel !== undefined) run('UPDATE users SET nivel = ? WHERE id = ?', [nivel, req.params.id]);
    if (permissions !== undefined) run('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), req.params.id]);
    if (telefone !== undefined) run('UPDATE users SET telefone = ? WHERE id = ?', [telefone, req.params.id]);
    if (active !== undefined) run('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, req.params.id]);
    run("UPDATE users SET updated_at = datetime('now') WHERE id = ?", [req.params.id]);

    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_update', 'users', req.params.id, 'Atualizado: ' + (name || '')]);
    res.json({ message: 'Usuário atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    const existing = get('SELECT id, name, email FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (existing.email === 'admin@valesaude.com.br') return res.status(400).json({ error: 'Não é possível excluir o administrador principal' });

    run('DELETE FROM users WHERE id = ?', [req.params.id]);
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_delete', 'users', req.params.id, 'Excluído: ' + existing.name]);
    res.json({ message: 'Usuário excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/change-password', (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });

    const existing = get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(newPassword).digest('hex');
    run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, req.params.id]);

    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', 'user_password_change', 'users', req.params.id, 'Senha alterada']);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/toggle-active', (req, res) => {
  try {
    const existing = get('SELECT id, email, active FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (existing.email === 'admin@valesaude.com.br') return res.status(400).json({ error: 'Não é possível desativar o administrador principal' });

    const newActive = existing.active ? 0 : 1;
    run('UPDATE users SET active = ?, updated_at = datetime("now") WHERE id = ?', [newActive, req.params.id]);
    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id || 'system', newActive ? 'user_activate' : 'user_deactivate', 'users', req.params.id, 'Status alterado para ' + (newActive ? 'ativo' : 'inativo')]);
    res.json({ message: newActive ? 'Usuário ativado' : 'Usuário desativado', active: newActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
router.get('/settings', (req, res) => {
  try {
    const rows = all('SELECT * FROM settings');
    const obj = {};
    rows.forEach(s => { obj[s.key] = s.value; });
    res.json({ settings: obj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))', [key, String(value)]);
    }
    res.json({ message: 'Configurações salvas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset system (clear all data)
router.post('/reset', (req, res) => {
  try {
    run('DELETE FROM payments');
    run('DELETE FROM requests');
    run('DELETE FROM notifications');
    run('DELETE FROM logs');
    run('DELETE FROM clients');
    run("INSERT INTO logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)",
      ['system', 'reset', '*', JSON.stringify({ action: 'Sistema zerado' })]);
    res.json({ message: 'Sistema zerado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset support clicks counter
router.post('/reset-support-clicks', (req, res) => {
  try {
    run("UPDATE settings SET value = '0', updated_at = datetime('now') WHERE key = 'support_click_count'");
    res.json({ message: 'Contador de suporte zerado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset dashboard counters (Pix, Push, page views, sessions) — keeps clients
router.post('/reset-counters', (req, res) => {
  try {
    run("UPDATE clients SET pix_copied_count = 0, pushinpay_click_count = 0, pix_copied_at = NULL");
    run('DELETE FROM sessions');
    run('DELETE FROM page_views');
    run("UPDATE settings SET value = '0', updated_at = datetime('now') WHERE key = 'support_click_count'");
    run("INSERT INTO logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)",
      ['system', 'reset-counters', '*', JSON.stringify({ action: 'Contadores do dashboard zerados' })]);
    res.json({ message: 'Contadores zerados com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SMS — Gerenciamento de Contas TopYing
// ============================================================

router.post('/sms/send', smsSendLimiter, async (req, res) => {
  try {
    var { phone, message, clientId } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message are required.' });

    var bodyPhone = phone.replace(/\D/g, '');
    if (bodyPhone.length <= 11) bodyPhone = '55' + bodyPhone;

    var ok = await smsPanel.send(bodyPhone, message, clientId, 'Manual');

    if (ok) {
      res.json({ status: 200, sent: true, via: 'topying' });
    } else {
      res.status(502).json({ error: 'Falha ao enviar SMS via TopYing', sent: false });
    }
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/sms/panel-status', smsReadLimiter, (req, res) => {
  try {
    res.json(smsPanel.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Account CRUD ──────────────────────────────────────────────────────────

router.get('/sms/accounts', smsReadLimiter, (req, res) => {
  try {
    var accs = smsPanel.getAccounts();
    var total = accs.length;
    var connected = accs.filter(function(a){ return a.healthy && a.hasSession; }).length;
    var active = accs.filter(function(a){ return a.active; }).length;
    res.json({ accounts: accs, summary: { total, connected, active } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sms/logs', smsReadLimiter, (req, res) => {
  try {
    var limit = parseInt(req.query.limit || '100', 10);
    var logs = smsPanel.getSendLogs(limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify all accounts — check session, remove invalid ones
router.post('/sms/accounts/verify', smsVerifyLimiter, async (req, res) => {
  try {
    var results = await smsPanel.verifyAllAccounts();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new account (save to DB + connect)
router.post('/sms/accounts/add', smsWriteLimiter, async (req, res) => {
  try {
    var { username, password, label } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Login e senha são obrigatórios' });

    var result = await smsPanel.addAccount(username, password, label || username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove account
router.delete('/sms/accounts/:id', smsWriteLimiter, (req, res) => {
  try {
    var ok = smsPanel.removeAccount(req.params.id);
    if (ok) res.json({ message: 'Conta removida' });
    else res.status(404).json({ error: 'Conta não encontrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle active/inactive
router.post('/sms/accounts/:id/toggle', smsWriteLimiter, (req, res) => {
  try {
    var { active } = req.body;
    var ok = smsPanel.toggleAccountActive(req.params.id, active);
    if (ok) res.json({ message: active ? 'Conta ativada' : 'Conta desativada', active });
    else res.status(404).json({ error: 'Conta não encontrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Connect account
router.post('/sms/accounts/:id/connect', smsWriteLimiter, async (req, res) => {
  try {
    var result = await smsPanel.connectAccount(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect account
router.post('/sms/accounts/:id/disconnect', smsWriteLimiter, (req, res) => {
  try {
    var ok = smsPanel.disconnectAccount(req.params.id);
    if (ok) res.json({ message: 'Conta desconectada' });
    else res.status(404).json({ error: 'Conta não encontrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SMS Config (short message template) ───────────────────────────────────

router.get('/sms/config', (req, res) => {
  try {
    var shortRow = get("SELECT value FROM settings WHERE key = 'sms_short_message'");
    var addRow = get("SELECT value FROM settings WHERE key = 'sms_additional_number'");
    var shortMessage = shortRow ? shortRow.value : '';
    var additionalNumber = addRow ? addRow.value : '';
    res.json({ shortMessage, additionalNumber, panel: 'TopYing', panelUrl: process.env.PANEL_BASE_URL || 'https://msg.topying.net' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sms/config', (req, res) => {
  try {
    var { sms_short_message, sms_additional_number } = req.body;
    if (sms_short_message !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_short_message', ?, datetime('now'))", [sms_short_message]);
    if (sms_additional_number !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_additional_number', ?, datetime('now'))", [sms_additional_number]);
    res.json({ message: 'SMS config saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SMS History — Retrieval
// ============================================================

// GET sms-history for a specific client (admin only)
router.get('/clients/:id/sms-history', (req, res) => {
  try {
    var clientId = req.params.id;
    var client = get('SELECT id FROM clients WHERE id = ?', [clientId]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    var history = all(
      `SELECT id, client_id, tipo, mensagem, status, created_at FROM sms_history WHERE client_id = ? ORDER BY created_at DESC LIMIT 50`,
      [clientId]
    );

    res.json({ history: history || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Image Manager — Scan, Replace, Upload & Deploy
// ============================================================

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');

const ASSETS_DIR = path.join(__dirname, '..', '..', '..', 'assets');
const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const IMAGE_EXTS = ['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
const EXCLUDE_DIRS = ['node_modules', '.edgeone', 'dist', 'backend', '.git'];

// Multer config — save uploaded files to assets/
var uploadStorage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, ASSETS_DIR); },
  filename: function(req, file, cb) {
    // Preserve original filename, add timestamp to avoid conflicts
    var ext = path.extname(file.originalname).toLowerCase();
    var base = path.basename(file.originalname, ext);
    // Remove special chars, keep alphanumeric + dash + underscore
    base = base.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 60);
    var finalName = base + ext;
    // If file exists, add suffix
    var counter = 1;
    while (fs.existsSync(path.join(ASSETS_DIR, finalName))) {
      finalName = base + '-' + counter + ext;
      counter++;
    }
    cb(null, finalName);
  }
});
var upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function(req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_EXTS.includes(ext)) cb(null, true);
    else cb(new Error('Formato não suportado: ' + ext + '. Use: ' + IMAGE_EXTS.join(', ')));
  }
});

// Helper: recursively find source files
function walkSourceFiles(dir, relativePath) {
  var entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return []; }
  var files = [];
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var fullPath = path.join(dir, entry.name);
    var relPath = relativePath ? relativePath + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
        files = files.concat(walkSourceFiles(fullPath, relPath));
      }
    } else if (entry.isFile()) {
      var ext = path.extname(entry.name).toLowerCase();
      if (['.html', '.js', '.tsx', '.ts', '.css', '.mjs'].includes(ext) &&
          !/^index-[a-zA-Z0-9_-]+\.(js|css)$/.test(entry.name)) {
        files.push({ fullPath: fullPath, relPath: relPath });
      }
    }
  }
  return files;
}

// Helper: find line number
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// GET /admin/images — list all images and their source references
router.get('/images', function(req, res) {
  try {
    // Scan assets folder
    var images = [];
    if (fs.existsSync(ASSETS_DIR)) {
      var files = fs.readdirSync(ASSETS_DIR);
      for (var i = 0; i < files.length; i++) {
        var ext = path.extname(files[i]).toLowerCase();
        if (IMAGE_EXTS.includes(ext)) {
          var stats = fs.statSync(path.join(ASSETS_DIR, files[i]));
          images.push({
            filename: files[i],
            ext: ext,
            size: stats.size,
            sizeFormatted: stats.size < 1024 ? stats.size + ' B' : stats.size < 1048576 ? (stats.size / 1024).toFixed(1) + ' KB' : (stats.size / 1048576).toFixed(1) + ' MB',
            modifiedAt: stats.mtime
          });
        }
      }
      images.sort(function(a, b) { return a.filename.localeCompare(b.filename); });
    }

    // Scan source files for references
    var sourceFiles = walkSourceFiles(ROOT_DIR, '');
    var imageRegex = /["'`]([^"'`]*\.(png|webp|jpg|jpeg|gif|svg|ico))["'`]/gi;
    var references = {};

    for (var s = 0; s < sourceFiles.length; s++) {
      var sf = sourceFiles[s];
      try {
        var content = fs.readFileSync(sf.fullPath, 'utf-8');
        imageRegex.lastIndex = 0;
        var match;
        while ((match = imageRegex.exec(content)) !== null) {
          var imgName = path.basename(match[1].trim());
          if (!references[imgName]) references[imgName] = [];
          var exists = references[imgName].some(function(r) { return r.file === sf.relPath && r.lineMatch === match[0]; });
          if (!exists) {
            references[imgName].push({
              file: sf.relPath,
              lineMatch: match[0],
              lineNumber: getLineNumber(content, match.index)
            });
          }
        }
      } catch(e) {}
    }

    // Helper: check if a filename matches a reference, handling Vite hash suffixes
    function matchFilename(imageFilename, refName) {
      if (imageFilename === refName) return true;
      // Check if refName is the base of a hash-versioned filename (e.g., hero-bane.webp -> hero-bane-XXXX.webp)
      var imageBase = path.basename(imageFilename, path.extname(imageFilename));
      var refBase = path.basename(refName, path.extname(refName));
      // Remove trailing hash pattern (-XXXXXXXX) from image filename before comparing
      var imageBaseClean = imageBase.replace(/-[a-zA-Z0-9_-]{8,}$/, '');
      if (imageBaseClean === refBase && path.extname(imageFilename) === path.extname(refName)) return true;
      return false;
    }

    // Build used/unused/missing
    var used = [];
    var unused = [];
    for (var j = 0; j < images.length; j++) {
      var matchedName = null;
      var refs = [];
      for (var refName in references) {
        if (matchFilename(images[j].filename, refName)) {
          matchedName = refName;
          refs = references[refName];
          break;
        }
      }
      if (refs.length > 0) {
        used.push({ ...images[j], references: refs, referencedAs: matchedName });
      } else {
        unused.push(images[j]);
      }
    }
    var missing = [];
    for (var name in references) {
      var found = images.some(function(i) { return matchFilename(i.filename, name); });
      if (!found) {
        missing.push({ filename: name, references: references[name] });
      }
    }

    var usedSize = used.reduce(function(s, i) { return s + i.size; }, 0);
    var unusedSize = unused.reduce(function(s, i) { return s + i.size; }, 0);

    res.json({
      images: { used: used, unused: unused, missing: missing },
      summary: {
        total: images.length,
        used: used.length,
        usedSize: usedSize,
        unused: unused.length,
        unusedSize: unusedSize,
        missing: missing.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/images/replace — replace old image with new, update refs
router.post('/images/replace', function(req, res) {
  try {
    var oldFilename = path.basename(req.body.oldFilename || '');
    var newFilename = path.basename(req.body.newFilename || '');
    if (!oldFilename || !newFilename) return res.status(400).json({ error: 'oldFilename e newFilename são obrigatórios' });

    var newPath = path.join(ASSETS_DIR, newFilename);
    if (!fs.existsSync(newPath)) return res.status(404).json({ error: 'Arquivo ' + newFilename + ' não encontrado em assets/' });

    var ext = path.extname(newFilename).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) return res.status(400).json({ error: 'Formato não suportado: ' + ext });

    // Replace in all source files
    var sourceFiles = walkSourceFiles(ROOT_DIR, '');
    var updatedFiles = [];
    var escapedOld = oldFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var oldRegex = new RegExp(escapedOld, 'g');

    for (var i = 0; i < sourceFiles.length; i++) {
      var sf = sourceFiles[i];
      try {
        var content = fs.readFileSync(sf.fullPath, 'utf-8');
        if (oldRegex.test(content)) {
          content = content.replace(oldRegex, newFilename);
          fs.writeFileSync(sf.fullPath, content, 'utf-8');
          updatedFiles.push(sf.relPath);
        }
      } catch(e) {}
    }

    res.json({
      message: oldFilename + ' → ' + newFilename,
      updatedFiles: updatedFiles,
      count: updatedFiles.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/images/delete — delete an image file
router.post('/images/delete', function(req, res) {
  try {
    var filename = path.basename(req.body.filename || '');
    if (!filename) return res.status(400).json({ error: 'filename é obrigatório' });

    var filePath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado' });

    fs.unlinkSync(filePath);
    res.json({ message: filename + ' excluído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/images/deploy — trigger EdgeOne deploy (assíncrono)
router.post('/images/deploy', function(req, res) {
  try {
    var deployScript = path.join(ROOT_DIR, 'deploy.cjs');
    if (!fs.existsSync(deployScript)) return res.status(404).json({ error: 'deploy.cjs não encontrado' });

    res.json({ message: 'Deploy iniciado! Acompanhe no terminal.' });

    exec('node deploy.cjs', { cwd: ROOT_DIR, timeout: 300000 }, function(err, stdout, stderr) {
      if (err) {
        console.error('[deploy] Erro:', err.message);
        return;
      }
      console.log('[deploy] Sucesso:', stdout.slice(0, 200));
    });
  } catch (err) {
    res.status(500).json({ error: 'Deploy falhou: ' + err.message });
  }
});

// POST /admin/images/upload — upload a new image to assets/
router.post('/images/upload', function(req, res) {
  upload.single('image')(req, res, function(err) {
    if (err) {
      if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      message: '✅ ' + req.file.filename + ' enviado com sucesso!'
    });
  });
});

// POST /admin/images/upload-and-replace — upload file AND replace references in source files
router.post('/images/upload-and-replace', function(req, res) {
  upload.single('image')(req, res, function(err) {
    if (err) {
      if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    var oldFilename = req.body.oldFilename || '';
    var newFilename = req.file.filename;

    if (!oldFilename) {
      return res.json({
        filename: newFilename,
        originalName: req.file.originalname,
        size: req.file.size,
        message: '✅ ' + newFilename + ' enviado com sucesso!'
      });
    }

    // Replace in source files
    var sourceFiles = walkSourceFiles(ROOT_DIR, '');
    var updatedFiles = [];
    var escapedOld = oldFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var oldRegex = new RegExp(escapedOld, 'g');

    for (var i = 0; i < sourceFiles.length; i++) {
      var sf = sourceFiles[i];
      try {
        var content = fs.readFileSync(sf.fullPath, 'utf-8');
        if (oldRegex.test(content)) {
          content = content.replace(oldRegex, newFilename);
          fs.writeFileSync(sf.fullPath, content, 'utf-8');
          updatedFiles.push(sf.relPath);
        }
      } catch(e) {}
    }

    res.json({
      filename: newFilename,
      originalName: req.file.originalname,
      size: req.file.size,
      message: '✅ ' + oldFilename + ' → ' + newFilename + ' (' + updatedFiles.length + ' arquivo(s) atualizado(s))',
      updatedFiles: updatedFiles,
      count: updatedFiles.length
    });
  });
});

module.exports = router;

