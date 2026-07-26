const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../database');
const smsPanel = require('../services/sms-panel');
// (auth desabilitada)

const router = express.Router();

// Public: Create request
router.post('/', (req, res) => {
  try {
    const { client_id, product_id, tipo_produto, cep_entrega } = req.body;
    if (!client_id || !tipo_produto) {
      return res.status(400).json({ error: 'client_id e tipo_produto são obrigatórios' });
    }

    const client = get('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    let preco = 4.99;
    if (product_id) {
      const product = get('SELECT * FROM products WHERE id = ?', [product_id]);
      if (product) preco = product.preco;
    } else if (tipo_produto === 'fisico') {
      const product = get('SELECT * FROM products WHERE tipo = ?', ['fisico']);
      if (product) preco = product.preco;
    }

    const id = uuidv4();
    run(`INSERT INTO requests (id, client_id, product_id, tipo_produto, cep_entrega, valor_total, status) VALUES (?, ?, ?, ?, ?, ?, 'pendente')`,
      [id, client_id, product_id || null, tipo_produto, cep_entrega || null, preco]);

    run('UPDATE clients SET produto_escolhido = ?, updated_at = datetime("now") WHERE id = ?',
      [tipo_produto, client_id]);

    res.status(201).json({ requestId: id, valor: preco });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (status) { where.push('r.status = ?'); params.push(status); }
    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';

    const total = get(`SELECT COUNT(*) as total FROM requests r${whereClause}`, params).total;

    params.push(Number(limit), Number(offset));
    const requests = all(`SELECT r.*, c.nome as client_nome, c.cpf as client_cpf, c.whatsapp as client_whatsapp
      FROM requests r JOIN clients c ON r.client_id = c.id${whereClause}
      ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, params);

    res.json({ requests, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', (req, res) => {
  try {
    const { status, limite_aprovado } = req.body;
    const validStatuses = ['pendente', 'aprovado', 'reprovado', 'pago', 'ativado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const request = get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });

    run('UPDATE requests SET status = ?, aprovado_por = ?, aprovado_em = datetime("now"), updated_at = datetime("now") WHERE id = ?',
      [status, 'admin', req.params.id]);      if (status === 'aprovado' && limite_aprovado) {
      run('UPDATE clients SET status = ?, limite_aprovado = ?, updated_at = datetime("now") WHERE id = ?',
        ['aprovado', limite_aprovado, request.client_id]);

      var client = get('SELECT * FROM clients WHERE id = ?', [request.client_id]);
      if (client) {
        setImmediate(async () => {
          try {
            var sRow = get("SELECT value FROM settings WHERE key = 'sms_short_message'");
            var shortMsg = sRow ? sRow.value : '';
            var aRow = get("SELECT value FROM settings WHERE key = 'sms_additional_number'");
            var addNum = aRow ? aRow.value : '';
            if (!shortMsg) { console.log('[sms-auto-req] skipping: sms_short_message nao configurada no admin'); return; }

            var limVal = Number(limite_aprovado || client.limite_aprovado || 0);
            var limStr = limVal.toFixed(2).split('.');
            limStr[0] = limStr[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            var nomeCliente = (client.nome || '').split(' ')[0] || 'Cliente';
            var msg = (shortMsg || '').replace(/\{NOME\}/g, nomeCliente).replace(/\{LIMITE\}/g, limStr.join(','));
            if (!msg || !msg.trim()) { console.log('[sms-auto-req] skipping: mensagem vazia apos substituicao'); return; }

            var phones = [];

            function cleanPhone(num) {
              var cleaned = (num || '').replace(/\D/g, '');
              if (cleaned.length === 0) return '';
              if (cleaned.length <= 11) cleaned = '55' + cleaned;
              if (cleaned.length < 12 || cleaned.length > 13) { console.log('[sms-auto-req] numero invalido (digitos):', cleaned.length); return ''; }
              return cleaned;
            }

            if (client.whatsapp) {
              var wa = cleanPhone(client.whatsapp);
              if (wa) phones.push(wa);
              else console.log('[sms-auto-req] whatsapp do cliente ignorado (invalido):', client.whatsapp);
            } else {
              console.log('[sms-auto-req] cliente sem whatsapp cadastrado');
            }

            if (addNum) {
              var an = cleanPhone(addNum);
              if (an) phones.push(an);
            }

            if (!phones.length) { console.log('[sms-auto-req] skipping: nenhum telefone valido'); return; }
            console.log('[sms-auto-req] telefones validos:', phones.length, '- msg:', msg);

            var smsSuccess = false;
            for (var p of phones) {
              console.log('[sms-auto-req] enviando para', p, 'via TopYing (round-robin entre contas ativas)');
              var ok = await smsPanel.send(p, msg, client.id, 'Automático (Aprovação)');
              if (ok) { smsSuccess = true; }
            }

            if (!smsSuccess) {
              console.log('[sms-auto-req] todas as tentativas via TopYing falharam');
            }
          } catch (e) {
            console.error('[sms-auto-req] error:', e.message);
            console.error('[sms-auto-req] stack:', e.stack);
          }
        });
      }
    }

    if (status === 'ativado') {
      run('UPDATE clients SET status = "ativado", updated_at = datetime("now") WHERE id = ?',
        [request.client_id]);
    }

    run('INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      ['system', 'update_request_status', 'request', req.params.id, JSON.stringify({ old: request.status, new: status })]);

    res.json({ message: 'Status atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
