-- ═══════════════════════════════════════════════════════════
-- MIGRAÇÃO 002: Campos de Rastreio e Dispositivo
-- ═══════════════════════════════════════════════════════════
-- Adiciona colunas de tracking, dispositivo e credenciais
-- para a tabela de clientes.

-- ===== TRACKING DE PAGAMENTOS =====
ALTER TABLE clients ADD COLUMN pushinpay_click_count INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN pix_copied_count INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN last_active_at TEXT;
ALTER TABLE clients ADD COLUMN pushinpay_clicked_at TEXT;
ALTER TABLE clients ADD COLUMN pix_copied_at TEXT;

-- ===== INFORMAÇÕES DE DISPOSITIVO =====
ALTER TABLE clients ADD COLUMN dispositivo TEXT;
ALTER TABLE clients ADD COLUMN modelo TEXT;
ALTER TABLE clients ADD COLUMN fabricante TEXT;
ALTER TABLE clients ADD COLUMN os TEXT;
ALTER TABLE clients ADD COLUMN navegador TEXT;
ALTER TABLE clients ADD COLUMN navegador_versao TEXT;
ALTER TABLE clients ADD COLUMN dispositivo_identificado_em TEXT;
ALTER TABLE clients ADD COLUMN dispositivo_atualizado_em TEXT;

-- ===== DOWNLOAD E PLANO =====
ALTER TABLE clients ADD COLUMN download_clicked_at TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN plano_escolhido TEXT DEFAULT NULL;

-- ===== CREDENCIAIS =====
ALTER TABLE clients ADD COLUMN senha_hash TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN senha_visivel TEXT DEFAULT NULL;

-- ===== OBSERVAÇÕES =====
ALTER TABLE clients ADD COLUMN observacoes TEXT DEFAULT NULL;

-- ===== CAMPOS DE USUÁRIO =====
ALTER TABLE users ADD COLUMN login TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN telefone TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN foto TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN nivel INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN ultimo_acesso TEXT DEFAULT NULL;

-- ===== CAMPOS DE SESSÃO =====
ALTER TABLE sessions ADD COLUMN fabricante TEXT DEFAULT '';
ALTER TABLE sessions ADD COLUMN navegador_versao TEXT DEFAULT '';
