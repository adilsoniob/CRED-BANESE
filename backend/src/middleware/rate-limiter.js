/**
 * Rate Limiter — Proteção Anti-Bloqueio para APIs Externas
 *
 * Cria limitadores de taxa reutilizáveis para endpoints do backend.
 * Usa express-rate-limit com armazenamento em memória (default).
 * 
 * SMS-specific limits:
 *  - Envio manual:      5 requisições por minuto por IP
 *  - Verificar contas:  2 requisições por minuto por IP
 *  - Adicionar conta:   5 requisições por minuto por IP
 *  - Conectar conta:    5 requisições por minuto por IP
 *  - Status/Logs:      30 requisições por minuto por IP (leitura leve)
 */

const rateLimit = require('express-rate-limit');

// ─── Helpers ────────────────────────────────────────────────────────────────

function createLimiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    message: { error: message || `Muitas requisições. Tente novamente em ${Math.ceil(windowMs / 1000 / 60)} minuto(s).` },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// ─── SMS Limiters ───────────────────────────────────────────────────────────

/** Envio manual de SMS — no máximo 5/min/IP */
const smsSendLimiter = createLimiter(
  60 * 1000,  // 1 minuto
  5,
  'Limite de envio SMS excedido. Máximo de 5 envios manuais por minuto. Aguarde e tente novamente.'
);

/** Verificação em massa de contas — no máximo 2/min/IP */
const smsVerifyLimiter = createLimiter(
  60 * 1000,  // 1 minuto
  2,
  'Limite de verificação de contas excedido. Máximo de 2 verificações por minuto.'
);

/** Operações de escrita (add, toggle, connect, disconnect) — 5/min/IP */
const smsWriteLimiter = createLimiter(
  60 * 1000,  // 1 minuto
  5,
  'Limite de operações em contas SMS excedido. Máximo de 5 operações por minuto.'
);

/** Leitura de status e logs — 30/min/IP (generoso) */
const smsReadLimiter = createLimiter(
  60 * 1000,  // 1 minuto
  30,
  'Limite de consultas SMS excedido. Aguarde um momento.'
);

module.exports = {
  smsSendLimiter,
  smsVerifyLimiter,
  smsWriteLimiter,
  smsReadLimiter,
};
