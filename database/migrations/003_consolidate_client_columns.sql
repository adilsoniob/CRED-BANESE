-- ═══════════════════════════════════════════════════════════
-- MIGRAÇÃO 003: Consolidação de colunas da tabela clients
-- ═══════════════════════════════════════════════════════════
-- Garante que todas as colunas usadas pelo sistema existam
-- na tabela clients. Seguro para re-execução (IF NOT EXISTS
-- via tratamento de "duplicate column").

-- ===== TRACKING DE PAGAMENTOS =====
ALTER TABLE clients ADD COLUMN pushinpay_click_count INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN pix_copied_count INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN last_active_at TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN pushinpay_clicked_at TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN pix_copied_at TEXT DEFAULT NULL;

-- ===== INFORMAÇÕES DE DISPOSITIVO =====
ALTER TABLE clients ADD COLUMN dispositivo TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN modelo TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN fabricante TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN os TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN navegador TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN navegador_versao TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN dispositivo_identificado_em TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN dispositivo_atualizado_em TEXT DEFAULT NULL;

-- ===== DOWNLOAD E PLANO =====
ALTER TABLE clients ADD COLUMN download_clicked_at TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN plano_escolhido TEXT DEFAULT NULL;

-- ===== CREDENCIAIS =====
ALTER TABLE clients ADD COLUMN senha_hash TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN senha_visivel TEXT DEFAULT NULL;

-- ===== OBSERVAÇÕES =====
ALTER TABLE clients ADD COLUMN observacoes TEXT DEFAULT NULL;

-- ===== EXTRAS FRONTEND =====
ALTER TABLE clients ADD COLUMN banese_cliente INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN app_download_clicked_at TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN app_download_status TEXT DEFAULT NULL;
