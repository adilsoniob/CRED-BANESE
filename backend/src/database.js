const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════
// REGRA DE PROTEÇÃO: Banco de produção fica SEPARADO do projeto
// DB_PATH é definido no .env do servidor: /database/credvale_producao.db
// NUNCA usar caminho dentro do projeto em produção
// ═══════════════════════════════════════════════════════════
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'vale-saude.db');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(__dirname, '..', '..', 'database', 'migrations');

const dbDir = path.dirname(DB_PATH);

// Gerador de ID seguro (tenta crypto.randomUUID, fallback uuid.v4)
function generateId() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (e) {}
  try {
    return require('uuid').v4();
  } catch (e) {
    // Fallback manual (nunca deve chegar aqui, uuid está em package.json)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// ═══════════════════════════════════════════════════════════
// VALIDAÇÃO: Verificar se o banco de produção existe
// ═══════════════════════════════════════════════════════════
function validateDatabase() {
  // Se DB_PATH aponta para /database/ (produção), verificar existência
  if (DB_PATH.startsWith('/database/')) {
    if (!fs.existsSync(DB_PATH)) {
      console.error('');
      console.error('═' .repeat(60));
      console.error('❌ ERRO FATAL: Banco de produção não encontrado!');
      console.error(`   Caminho esperado: ${DB_PATH}`);
      console.error('');
      console.error('   O sistema NÃO vai iniciar com banco vazio.');
      console.error('   Isso evita perda de dados se o banco for restaurado depois.');
      console.error('');
      console.error('   Para resolver:');
      console.error('   1. Restaure o backup: cp /tmp/backup_*.db ' + DB_PATH);
      console.error('   2. Verifique: ls -la /database/credvale_producao.db');
      console.error('═' .repeat(60));
      console.error('');
      process.exit(1);
    }

    // Verificar integridade mínima (arquivo maior que 4KB)
    const stats = fs.statSync(DB_PATH);
    if (stats.size < 4096) {
      console.warn('[DB] ⚠ Aviso: Banco de produção parece estar vazio (' + stats.size + ' bytes)');
    } else {
      console.log('[DB] ✅ Banco de produção encontrado: ' + DB_PATH + ' (' + stats.size + ' bytes)');
    }
  } else {
    console.log('[DB] ⚠ Modo desenvolvimento: ' + DB_PATH);
  }
  return true;
}

let db = null;
let saveTimer = null;

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (db) {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
  }, 1000);
}

function run(sql, params = []) {
  db.run(sql, params);
  scheduleSave();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    results.push(row);
  }
  stmt.free();
  return results;
}

// ═══════════════════════════════════════════════════════════
// SISTEMA DE MIGRAÇÕES SEGURAS
// ═══════════════════════════════════════════════════════════
// Toda alteração no schema deve ser feita via migration.
// Migrações ficam em database/migrations/NNN_description.sql
// A tabela _migrations controla quais já foram executadas.
// ═══════════════════════════════════════════════════════════
async function runMigrations() {
  // Garantir que a tabela de controle existe
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TEXT DEFAULT (datetime('now')),
      hash TEXT,
      status TEXT DEFAULT 'ok'
    )
  `);

  // Verificar se o diretório de migrações existe
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[DB] ⚠ Diretório de migrações não encontrado: ' + MIGRATIONS_DIR);
    return;
  }

  // Listar arquivos .sql ordenados por nome
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[DB] Nenhuma migração pendente');
    return;
  }

  // Verificar quais já foram executadas
  const executed = new Set();
  const rows = all('SELECT filename FROM _migrations');
  rows.forEach(r => executed.add(r.filename));

  let executedCount = 0;
  for (const file of files) {
    if (executed.has(file)) {
      console.log('[DB] 📁 Migração já executada: ' + file);
      continue;
    }

    console.log('[DB] 🔄 Executando migração: ' + file + '...');
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const fileHash = crypto.createHash('sha256').update(sql).digest('hex').substring(0, 16);

    try {
      // Executar cada statement da migração
      const statements = sql
        .split(';')
        .map(s => s.trim())
        // Remove linhas de comentário do início e filtra linhas vazias/comentários
.map(s => s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
.filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          db.run(stmt);
        } catch (stmtErr) {
          // Ignorar erros de "duplicate column" (ALTER TABLE já executado)
          if (stmtErr.message && stmtErr.message.includes('duplicate column')) {
            console.log('[DB] ⚠ Coluna já existe, ignorando: ' + stmt.substring(0, 60));
          } else {
            throw stmtErr;
          }
        }
      }

      // Registrar migração como executada
      const id = generateId();
      run("INSERT OR REPLACE INTO _migrations (id, filename, hash, status) VALUES (?, ?, ?, 'ok')",
        [id, file, fileHash]);

      console.log('[DB] ✅ Migração executada: ' + file);
      executedCount++;
    } catch (err) {
      console.error('[DB] ❌ Erro na migração ' + file + ': ' + err.message);
      // Registrar falha para diagnóstico
      const id = generateId();
      try {
        run("INSERT OR REPLACE INTO _migrations (id, filename, hash, status) VALUES (?, ?, ?, 'failed')",
          [id, file, fileHash]);
      } catch (e) {}
    }
  }

  if (executedCount > 0) {
    console.log('[DB] 🎯 ' + executedCount + ' migração(ns) executada(s) com sucesso');
  } else {
    console.log('[DB] ✅ Nenhuma migração nova para executar');
  }
}

// ═══════════════════════════════════════════════════════════
// INICIALIZAÇÃO DO BANCO
// ═══════════════════════════════════════════════════════════
async function initDatabase() {
  // Validar banco de produção (fatal se não existir em produção)
  validateDatabase();

  // Criar diretório do banco se não existir
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Banco carregado do disco (' + DB_PATH + ')');
  } else {
    console.log('[DB] ⚠ Criando novo banco de dados em: ' + DB_PATH);
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // ═══════════════════════════════════════════════════════════
  // SCHEMA INICIAL (IF NOT EXISTS — seguro para reload)
  // Mantido aqui para compatibilidade com banco existente.
  // Novas alterações de schema DEVEM ser feitas via migrações.
  // ═══════════════════════════════════════════════════════════

  // Users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operador',
      permissions TEXT DEFAULT '[]',
      active INTEGER DEFAULT 1,
      login TEXT,
      nivel INTEGER DEFAULT 1,
      telefone TEXT,
      foto TEXT,
      ultimo_acesso TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Clients
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      cpf TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      nome_mae TEXT,
      nascimento TEXT,
      sexo TEXT,
      whatsapp TEXT,
      email TEXT,
      cep TEXT,
      rua TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      status TEXT DEFAULT 'pendente',
      limite_aprovado REAL DEFAULT 0,
      produto_escolhido TEXT DEFAULT 'virtual',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      -- campos adicionados via migrações
      pushinpay_click_count INTEGER DEFAULT 0,
      pix_copied_count INTEGER DEFAULT 0,
      last_active_at TEXT DEFAULT NULL,
      pushinpay_clicked_at TEXT DEFAULT NULL,
      pix_copied_at TEXT DEFAULT NULL,
      dispositivo TEXT DEFAULT NULL,
      modelo TEXT DEFAULT NULL,
      fabricante TEXT DEFAULT NULL,
      os TEXT DEFAULT NULL,
      navegador TEXT DEFAULT NULL,
      navegador_versao TEXT DEFAULT NULL,
      dispositivo_identificado_em TEXT DEFAULT NULL,
      dispositivo_atualizado_em TEXT DEFAULT NULL,
      download_clicked_at TEXT DEFAULT NULL,
      plano_escolhido TEXT DEFAULT NULL,
      senha_hash TEXT DEFAULT NULL,
      senha_visivel TEXT DEFAULT NULL,
      observacoes TEXT DEFAULT NULL,
      banese_cliente INTEGER DEFAULT 0,
      app_download_clicked_at TEXT DEFAULT NULL,
      app_download_status TEXT DEFAULT NULL
    )
  `);

  // Safe migration: ensure all columns exist (for databases created before this update)
  var _cols = [
    "pushinpay_click_count INTEGER DEFAULT 0",
    "pix_copied_count INTEGER DEFAULT 0",
    "last_active_at TEXT",
    "pushinpay_clicked_at TEXT",
    "pix_copied_at TEXT",
    "dispositivo TEXT",
    "modelo TEXT",
    "fabricante TEXT",
    "os TEXT",
    "navegador TEXT",
    "navegador_versao TEXT",
    "dispositivo_identificado_em TEXT",
    "dispositivo_atualizado_em TEXT",
    "download_clicked_at TEXT DEFAULT NULL",
    "plano_escolhido TEXT DEFAULT NULL",
    "senha_hash TEXT DEFAULT NULL",
    "senha_visivel TEXT DEFAULT NULL",
    "observacoes TEXT DEFAULT NULL",
    "banese_cliente INTEGER DEFAULT 0",
    "app_download_clicked_at TEXT DEFAULT NULL",
    "app_download_status TEXT DEFAULT NULL"
  ];
  for (var colDef of _cols) {
    try { db.run('ALTER TABLE clients ADD COLUMN ' + colDef); } catch(e) { if (!e.message.includes('duplicate column')) throw e; }
  }

  // Products
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      tipo TEXT NOT NULL,
      preco REAL NOT NULL,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Plans
  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco_mensal REAL NOT NULL,
      limite REAL NOT NULL,
      beneficios TEXT DEFAULT '[]',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Requests
  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      product_id TEXT,
      plan_id TEXT,
      tipo_produto TEXT DEFAULT 'virtual',
      cep_entrega TEXT,
      prazo_entrega TEXT,
      taxa_emissao REAL DEFAULT 0,
      valor_total REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      aprovado_por TEXT,
      aprovado_em TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Payments
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      metodo TEXT NOT NULL,
      valor REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      transaction_id TEXT,
      pix_qr_code TEXT,
      pix_chave TEXT,
      card_last_four TEXT,
      card_brand TEXT,
      parcelas INTEGER DEFAULT 1,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Reactivations
  db.run(`
    CREATE TABLE IF NOT EXISTS reactivations (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      request_id TEXT,
      motivo TEXT,
      valor REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      client_id TEXT,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      mensagem TEXT,
      lida INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Logs
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Settings
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Page views
  db.run(`
    CREATE TABLE IF NOT EXISTS page_views (
      id TEXT PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      referrer TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Client passwords
  db.run(`
    CREATE TABLE IF NOT EXISTS client_passwords (
      client_id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      visitor_id TEXT,
      client_id TEXT,
      stage TEXT DEFAULT 'Visitando Landing Page',
      ip TEXT,
      user_agent TEXT,
      dispositivo TEXT DEFAULT '',
      modelo TEXT DEFAULT '',
      fabricante TEXT DEFAULT '',
      navegador TEXT DEFAULT '',
      navegador_versao TEXT DEFAULT '',
      os TEXT DEFAULT '',
      origem TEXT DEFAULT '',
      nome TEXT,
      cpf TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      last_heartbeat TEXT DEFAULT (datetime('now')),
      last_activity TEXT DEFAULT (datetime('now')),
      offline_at TEXT
    )
  `);

  // Permissions
  db.run(`
    CREATE TABLE IF NOT EXISTS permissoes (
      id TEXT PRIMARY KEY,
      nome TEXT UNIQUE NOT NULL,
      descricao TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuario_permissoes (
      usuario_id TEXT NOT NULL,
      permissao_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (usuario_id, permissao_id),
      FOREIGN KEY (usuario_id) REFERENCES users(id),
      FOREIGN KEY (permissao_id) REFERENCES permissoes(id)
    )
  `);

  // App versions
  db.run(`
    CREATE TABLE IF NOT EXISTS app_versions (
      id TEXT PRIMARY KEY,
      file_name TEXT,
      original_name TEXT,
      version TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      file_type TEXT DEFAULT 'apk',
      external_link TEXT,
      status TEXT DEFAULT 'archived',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      uploaded_by TEXT
    )
  `);

  // SMS history
  db.run(`
    CREATE TABLE IF NOT EXISTS sms_history (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'enviado',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // App downloads
  db.run(`
    CREATE TABLE IF NOT EXISTS app_downloads (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      client_cpf TEXT,
      client_nome TEXT,
      status TEXT NOT NULL DEFAULT 'iniciado',
      apk_available INTEGER DEFAULT 1,
      device_info TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // ═══════════════════════════════════════════════════════════
  // EXECUTAR MIGRAÇÕES PENDENTES
  // ═══════════════════════════════════════════════════════════
  await runMigrations();

  // ═══════════════════════════════════════════════════════════
  // SEEDS (apenas se não existirem — seguro para reload)
  // ═══════════════════════════════════════════════════════════

  // Admin user
  const existingAdmin = get('SELECT id FROM users WHERE email = ?', ['admin@valesaude.com.br']);
  if (!existingAdmin) {
    const hash = crypto.createHash('sha256').update('admin123').digest('hex');
    run(`INSERT INTO users (id, email, password_hash, name, role, permissions, nivel) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), 'admin@valesaude.com.br', hash, 'Administrador', 'admin', JSON.stringify(['*']), 3]);
    run(`INSERT INTO users (id, email, password_hash, name, role, permissions, nivel) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), 'operador@valesaude.com.br', hash, 'Operador', 'operador', JSON.stringify(['dashboard.view', 'clientes.view', 'clientes.edit']), 1]);
    run(`INSERT INTO users (id, email, password_hash, name, role, permissions, nivel) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), 'suporte@valesaude.com.br', hash, 'Suporte', 'suporte', JSON.stringify(['clientes.view', 'notificacoes.view']), 1]);
  }

  // Fix user levels
  try { run("UPDATE users SET nivel = 3, login = email WHERE role = 'admin' AND (nivel IS NULL OR nivel > 3 OR nivel = 3)"); } catch (e) {}
  try { run("UPDATE users SET nivel = 1, login = email WHERE role = 'operador' AND (nivel IS NULL OR nivel > 1)"); } catch (e) {}
  try { run("UPDATE users SET nivel = 1, login = email WHERE role = 'suporte' AND (nivel IS NULL OR nivel > 1)"); } catch (e) {}
  try { run("UPDATE users SET nivel = 1 WHERE nivel IS NULL"); } catch (e) {}

  // Default permissions
  const permList = [
    ['dashboard.view', 'Visualizar Dashboard'],
    ['clientes.view', 'Visualizar Clientes'],
    ['clientes.edit', 'Editar Clientes'],
    ['clientes.delete', 'Excluir Clientes'],
    ['apk.view', 'Visualizar APK'],
    ['apk.upload', 'Enviar APK'],
    ['apk.delete', 'Excluir APK'],
    ['sms.view', 'Visualizar SMS'],
    ['sms.edit', 'Editar SMS'],
    ['pix.view', 'Visualizar PIX'],
    ['pix.edit', 'Editar PIX'],
    ['usuarios.view', 'Visualizar Usuários'],
    ['usuarios.create', 'Criar Usuários'],
    ['usuarios.edit', 'Editar Usuários'],
    ['usuarios.delete', 'Excluir Usuários'],
    ['config.view', 'Visualizar Configurações'],
    ['config.edit', 'Editar Configurações'],
    ['logs.view', 'Visualizar Logs'],
    ['notificacoes.view', 'Visualizar Notificações'],
  ];
  for (const [nome, descricao] of permList) {
    const existingPerm = get('SELECT id FROM permissoes WHERE nome = ?', [nome]);
    if (!existingPerm) {
      run('INSERT INTO permissoes (id, nome, descricao) VALUES (?, ?, ?)', [generateId(), nome, descricao]);
    }
  }

  // Default products
  const existingProduct = get('SELECT id FROM products LIMIT 1');
  if (!existingProduct) {
    run(`INSERT INTO products (id, nome, descricao, tipo, preco) VALUES (?, ?, ?, ?, ?)`,
      [generateId(), 'Vale Saúde Virtual', 'Ativação imediata pelo aplicativo', 'virtual', 4.99]);
    run(`INSERT INTO products (id, nome, descricao, tipo, preco) VALUES (?, ?, ?, ?, ?)`,
      [generateId(), 'Vale Saúde Físico', 'Cartão físico entregue em casa', 'fisico', 19.99]);
  }

  // Default plans
  const existingPlan = get('SELECT id FROM plans LIMIT 1');
  if (!existingPlan) {
    run(`INSERT INTO plans (id, nome, descricao, preco_mensal, limite, beneficios) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), 'Básico', 'Limite para medicamentos essenciais', 0, 500, JSON.stringify(['Uso em farmácias parceiras', 'App mobile', 'Histórico de compras'])]);
    run(`INSERT INTO plans (id, nome, descricao, preco_mensal, limite, beneficios) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), 'Premium', 'Limite ampliado com benefícios extras', 0, 1500, JSON.stringify(['Uso em farmácias parceiras', 'App mobile', 'Histórico de compras', 'Descontos exclusivos', 'Suporte prioritário'])]);
  }

  scheduleSave();
  console.log('[DB] ✅ Banco de dados inicializado com sucesso');
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('[DB] 💾 Banco salvo e encerrado');
  }
  process.exit(0);
});

module.exports = { getDb, initDatabase, run, get, all };
