const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'src', 'routes', 'admin.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the SMS section
const marker = '// ============================================================\n// SMS System Proxy\n// ============================================================';

const idx = content.indexOf(marker);
if (idx < 0) {
  console.error('ERROR: SMS section marker not found');
  process.exit(1);
}

// The new SMS section with both proxy + TopYing
const newSmsSection = `// ============================================================
// SMS — Proxy Externo (Webhook)
// ============================================================

function getSmsConfig() {
  var url = '', key = '', accounts = [], shortMessage = '', additionalNumber = '', activeAccounts = [];
  var urlRow = get("SELECT value FROM settings WHERE key = 'sms_system_url'");
  if (urlRow) url = urlRow.value;
  var keyRow = get("SELECT value FROM settings WHERE key = 'sms_system_api_key'");
  if (keyRow) key = keyRow.value;
  var accRow = get("SELECT value FROM settings WHERE key = 'sms_accounts'");
  if (accRow) { try { accounts = JSON.parse(accRow.value); } catch {} }
  var shortRow = get("SELECT value FROM settings WHERE key = 'sms_short_message'");
  if (shortRow) shortMessage = shortRow.value;
  var addRow = get("SELECT value FROM settings WHERE key = 'sms_additional_number'");
  if (addRow) additionalNumber = addRow.value;
  var actRow = get("SELECT value FROM settings WHERE key = 'sms_active_accounts'");
  if (actRow) { try { activeAccounts = JSON.parse(actRow.value); } catch {} }
  return { url, key, accounts, shortMessage, additionalNumber, activeAccounts };
}

router.post('/sms/send', async (req, res) => {
  try {
    var cfg = getSmsConfig();
    if (!cfg.url || !cfg.key) return res.status(400).json({ error: 'SMS system not configured. Set URL and API key in settings.' });

    var { phone, message, selectedAccounts } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message are required.' });

    var webhookUrl = cfg.url.replace(/\\/+$/, '') + '/api/webhook/send';
    var bodyPhone = phone.replace(/\\D/g, '');
    if (bodyPhone.length <= 11) bodyPhone = '55' + bodyPhone;
    var body = { phone: bodyPhone, message: message };
    if (selectedAccounts && selectedAccounts.length) body.selectedAccounts = selectedAccounts;

    var resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key },
      body: JSON.stringify(body)
    });

    var text = await resp.text();
    var data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!resp.ok) {
      console.error('[SMS] Error:', resp.status, text, 'URL:', webhookUrl);
    }

    res.status(resp.status).json({ status: resp.status, data: data, sent_to: webhookUrl });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/sms/accounts', (req, res) => {
  try {
    var cfg = getSmsConfig();
    res.json({ accounts: cfg.accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sms/config', (req, res) => {
  try {
    var { sms_system_url, sms_system_api_key, sms_accounts, sms_short_message, sms_additional_number, sms_active_accounts } = req.body;
    if (sms_system_url !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_system_url', ?, datetime('now'))", [sms_system_url]);
    if (sms_system_api_key !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_system_api_key', ?, datetime('now'))", [sms_system_api_key]);
    if (sms_accounts !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_accounts', ?, datetime('now'))", [JSON.stringify(sms_accounts)]);
    if (sms_short_message !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_short_message', ?, datetime('now'))", [sms_short_message]);
    if (sms_additional_number !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_additional_number', ?, datetime('now'))", [sms_additional_number]);
    if (sms_active_accounts !== undefined) run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sms_active_accounts', ?, datetime('now'))", [JSON.stringify(sms_active_accounts)]);
    res.json({ message: 'SMS config saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sms/config', (req, res) => {
  try {
    var cfg = getSmsConfig();
    res.json({ url: cfg.url, key: cfg.key ? 'defined' : '', accounts: cfg.accounts, shortMessage: cfg.shortMessage, additionalNumber: cfg.additionalNumber, activeAccounts: cfg.activeAccounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SMS — Gerenciamento de Contas TopYing
// ============================================================

router.post('/sms/panel/send', smsSendLimiter, async (req, res) => {
  try {
    var { phone, message, clientId } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message are required.' });

    var bodyPhone = phone.replace(/\\D/g, '');
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

router.get('/sms/panel/status', smsReadLimiter, (req, res) => {
  try {
    res.json(smsPanel.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sms/panel/accounts', smsReadLimiter, (req, res) => {
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

router.get('/sms/panel/logs', smsReadLimiter, (req, res) => {
  try {
    var limit = parseInt(req.query.limit || '100', 10);
    var logs = smsPanel.getSendLogs(limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify all accounts
router.post('/sms/panel/accounts/verify', smsVerifyLimiter, async (req, res) => {
  try {
    var results = await smsPanel.verifyAllAccounts();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new account
router.post('/sms/panel/accounts/add', smsWriteLimiter, async (req, res) => {
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
router.delete('/sms/panel/accounts/:id', smsWriteLimiter, (req, res) => {
  try {
    var ok = smsPanel.removeAccount(req.params.id);
    if (ok) res.json({ message: 'Conta removida' });
    else res.status(404).json({ error: 'Conta não encontrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle active/inactive
router.post('/sms/panel/accounts/:id/toggle', smsWriteLimiter, (req, res) => {
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
router.post('/sms/panel/accounts/:id/connect', smsWriteLimiter, async (req, res) => {
  try {
    var result = await smsPanel.connectAccount(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect account
router.post('/sms/panel/accounts/:id/disconnect', smsWriteLimiter, (req, res) => {
  try {
    var ok = smsPanel.disconnectAccount(req.params.id);
    if (ok) res.json({ message: 'Conta desconectada' });
    else res.status(404).json({ error: 'Conta não encontrada' });
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
      'SELECT id, client_id, tipo, mensagem, status, created_at FROM sms_history WHERE client_id = ? ORDER BY created_at DESC LIMIT 50',
      [clientId]
    );

    res.json({ history: history || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;`;

// Replace from marker to end of file
const endIdx = content.lastIndexOf('module.exports = router;');
if (endIdx < 0) {
  console.error('ERROR: module.exports not found');
  process.exit(1);
}

// Find the start of the SMS section
const smsStartIdx = content.indexOf(marker);
content = content.substring(0, smsStartIdx) + newSmsSection;

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ admin.js routes updated successfully!');
