-- ═══════════════════════════════════════════════════════════
-- MIGRAÇÃO 001: Schema Inicial do CredVale
-- ═══════════════════════════════════════════════════════════
-- Esta migração cria todas as tabelas fundamentais do sistema.
-- Utiliza IF NOT EXISTS para ser segura em ambientes já existentes.

-- ==================== USUÁRIOS ADMIN ====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador',
  permissions TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==================== CLIENTES ====================
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
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==================== PRODUTOS ====================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,
  preco REAL NOT NULL,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== PLANOS ====================
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_mensal REAL NOT NULL,
  limite REAL NOT NULL,
  beneficios TEXT DEFAULT '[]',
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== SOLICITAÇÕES ====================
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
);

-- ==================== PAGAMENTOS ====================
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
);

-- ==================== REATIVAÇÕES ====================
CREATE TABLE IF NOT EXISTS reactivations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  request_id TEXT,
  motivo TEXT,
  valor REAL NOT NULL,
  status TEXT DEFAULT 'pendente',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== NOTIFICAÇÕES ====================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  client_id TEXT,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  lida INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== LOGS ====================
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== CONFIGURAÇÕES ====================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==================== VISUALIZAÇÕES ====================
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== SENHAS DE CLIENTES ====================
CREATE TABLE IF NOT EXISTS client_passwords (
  client_id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- ==================== SESSÕES ====================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  visitor_id TEXT,
  client_id TEXT,
  stage TEXT DEFAULT 'Visitando Landing Page',
  ip TEXT,
  user_agent TEXT,
  dispositivo TEXT DEFAULT '',
  modelo TEXT DEFAULT '',
  navegador TEXT DEFAULT '',
  os TEXT DEFAULT '',
  origem TEXT DEFAULT '',
  nome TEXT,
  cpf TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  last_heartbeat TEXT DEFAULT (datetime('now')),
  last_activity TEXT DEFAULT (datetime('now')),
  offline_at TEXT
);

-- ==================== PERMISSÕES ====================
CREATE TABLE IF NOT EXISTS permissoes (
  id TEXT PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  descricao TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usuario_permissoes (
  usuario_id TEXT NOT NULL,
  permissao_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, permissao_id),
  FOREIGN KEY (usuario_id) REFERENCES users(id),
  FOREIGN KEY (permissao_id) REFERENCES permissoes(id)
);

-- ==================== VERSÕES DO APP ====================
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
);

-- ==================== HISTÓRICO DE SMS ====================
CREATE TABLE IF NOT EXISTS sms_history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- ==================== DOWNLOADS DO APP ====================
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
);

-- ==================== CONTROLE DE MIGRAÇÕES ====================
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  executed_at TEXT DEFAULT (datetime('now')),
  hash TEXT,
  status TEXT DEFAULT 'ok'
);
