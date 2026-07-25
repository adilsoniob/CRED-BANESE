#!/usr/bin/env python3
"""Fix all pending items for Banese+CredVale."""

import re

# ===== 1. Fix cadastro.js =====
with open('cadastro.js', 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# Fix 1: Update welcome message (mostrarTelaBoasVindas)
old_welcome = '''    addMsg(
      '<div style="text-align:center;padding:8px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(59,130,246,0.08));display:flex;align-items:center;justify-content:center;border:2px solid rgba(16,185,129,0.12);">' +
            '<span style="font-size:1.5rem;">🎉</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:1.2rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Olá, ' + primeiroNome + '!</div>' +
        '<div style="font-size:0.95rem;font-weight:600;color:#4CC8A4;margin-bottom:6px;">Seja bem-vindo(a)!</div>' +
        '<div style="font-size:0.82rem;color:#475569;line-height:1.6;margin-bottom:8px;">' +
          'Seu cadastro foi concluído com sucesso.<br><br>' +
          'Agora basta baixar o aplicativo para acessar sua conta e começar a utilizar todos os seus benefícios.' +
        '</div>' +
      '</div>',
      'bot'
    );'''

new_welcome = '''    addMsg(
      '<div style="text-align:center;padding:8px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">' +
          '<div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#022c22,#065F46);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(4,120,87,0.25);">' +
            '<span style="font-size:1.8rem;">🎉</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:1.3rem;font-weight:900;color:#047857;margin-bottom:4px;">🎉 Cadastro concluído com sucesso!</div>' +
        '<div style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:8px;">Seu acesso está sendo preparado.</div>' +
        '<div style="font-size:0.85rem;color:#475569;line-height:1.6;margin-bottom:8px;">' +
          'Enquanto isso você já pode baixar o aplicativo ou falar com um especialista para começar a aproveitar todos os seus benefícios.' +
        '</div>' +
      '</div>',
      'bot'
    );'''

if old_welcome in content:
    content = content.replace(old_welcome, new_welcome)
    changes.append('Welcome message updated')
else:
    changes.append('Welcome NOT FOUND - trying alternative')

# Fix 2: Update final buttons (mostrarBotoesFinais)
old_buttons = '''  async function mostrarBotoesFinais(clientId, limite) {
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
      wa = String(wa).replace(/\\D/g,'');
      if (wa.length <= 11) wa = '55' + wa;
      window.open('https://wa.me/' + wa + '?text=Olá! Já sou cliente CredVale e preciso de ajuda.', '_blank');
    };
  }'''

new_buttons = '''  async function mostrarBotoesFinais(clientId, limite) {
    hideInput();

    addMsg(
      '<div class="chat-options" style="gap:12px;">' +
        '<button class="chat-option" id="btnBaixarFim" style="width:100%;padding:18px;font-size:1rem;font-weight:800;border-radius:14px;background:linear-gradient(135deg,#047857,#065F46);color:#fff;border:none;box-shadow:0 4px 16px rgba(4,120,87,0.25);">🟢 Baixar o aplicativo CredVale</button>' +
        '<button class="chat-option" id="btnSuporteFim" style="width:100%;padding:16px;font-size:0.95rem;font-weight:700;border-radius:14px;border:1.5px solid #3B82F6;color:#3B82F6;background:rgba(59,130,246,0.04);">🔵 Falar com um especialista</button>' +
      '</div>'
    );

    document.getElementById('btnBaixarFim').onclick = function() {
      showDownloadModalInChat(clientId, limite);
    };

    document.getElementById('btnSuporteFim').onclick = function() {
      var wa = typeof __supportWhatsApp !== 'undefined' && __supportWhatsApp ? __supportWhatsApp : sessionStorage.getItem('vs_support_wa') || '5511999999999';
      wa = String(wa).replace(/\\D/g,'');
      if (wa.length <= 11) wa = '55' + wa;
      window.open('https://wa.me/' + wa + '?text=Olá! Já sou cliente CredVale e gostaria de falar com um especialista.', '_blank');
    };
  }'''

if old_buttons in content:
    content = content.replace(old_buttons, new_buttons)
    changes.append('Final buttons updated with Banese styling')
else:
    changes.append('Buttons NOT FOUND - checking exact match')
    # Try to find the function signature
    if 'mostrarBotoesFinais' in content:
        changes.append('Found function but exact match failed')

# Fix 3: Add password strength JS listener to credential form
# Find the credential validation code and add password strength listener before the validation
old_cred_validation = '''    document.getElementById('btnCadastrarCredenciais').onclick = function() {
      var pw = document.getElementById('credPassword').value;
      var confirmPw = document.getElementById('credConfirmPassword').value;'''

new_cred_validation = '''    document.getElementById('credPassword').addEventListener('input', function() {
      var val = this.value.replace(/\\D/g, '');
      this.value = val;
      var len = val.length;
      var ps1 = document.getElementById('ps1');
      var ps2 = document.getElementById('ps2');
      var ps3 = document.getElementById('ps3');
      if (ps1) { ps1.style.background = len >= 1 ? '#f59e0b' : '#e2e8f0'; }
      if (ps2) { ps2.style.background = len >= 3 ? '#f59e0b' : '#e2e8f0'; }
      if (ps3) { ps3.style.background = len >= 5 ? '#10B981' : '#e2e8f0'; }
    });
    document.getElementById('credConfirmPassword').addEventListener('input', function() {
      this.value = this.value.replace(/\\D/g, '');
    });
    document.getElementById('btnCadastrarCredenciais').onclick = function() {
      var pw = document.getElementById('credPassword').value;
      var confirmPw = document.getElementById('credConfirmPassword').value;'''

if old_cred_validation in content:
    content = content.replace(old_cred_validation, new_cred_validation)
    changes.append('Password strength indicator JS added')
else:
    changes.append('Cred validation NOT FOUND')

# Fix 4: Update favicon in cadastro.html
with open('cadastro.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

old_favicon = '''<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22url(%23g)%22/><defs><linearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22><stop offset=%220%25%22 stop-color=%22%233B82F6%22/><stop offset=%22100%25%22 stop-color=%22%234CC8A4%22/></linearGradient></defs><text x=%2216%22 y=%2223%22 font-family=%22system-ui%22 font-size=%2218%22 fill=%22%23fff%22 text-anchor=%22middle%22 font-weight=%22800%22>V</text></svg>">'''

new_favicon = '''<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22url(%23g)%22/><defs><linearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22><stop offset=%220%25%22 stop-color=%22%23022c22%22/><stop offset=%22100%25%22 stop-color=%22%2310b981%22/></linearGradient></defs><text x=%2216%22 y=%2223%22 font-family=%22system-ui%22 font-size=%2214%22 fill=%22%23fff%22 text-anchor=%22middle%22 font-weight=%22900%22>B+CV</text></svg>">'''

if old_favicon in html_content:
    html_content = html_content.replace(old_favicon, new_favicon)
    changes.append('Favicon updated to B+CV branding')
else:
    changes.append('Favicon NOT FOUND')

# Save cadastro.html
with open('cadastro.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

# Save cadastro.js
with open('cadastro.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Changes:')
for c in changes:
    print(f'  - {c}')
