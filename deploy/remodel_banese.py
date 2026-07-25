#!/usr/bin/env python3
"""Remodel remaining sections of cadastro.js for Banese+CredVale premium flow."""

import re

with open('cadastro.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Track changes
changes = []

# ===== 1. Replace plan offer pricing =====
# Old: "R$ 1,66/mês" -> "R$ 0,99/mês"
if 'R$ 1,66/mês' in content:
    content = content.replace('R$ 1,66/mês', 'R$ 0,99/mês')
    content = content.replace('R$ 1,66', 'R$ 0,99')
    changes.append('Plan pricing: R$ 1,66 -> R$ 0,99')

# ===== 2. Replace welcome message (mostrarTelaBoasVindas) =====
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
    changes.append('Welcome message remodeled with Banese branding')
else:
    changes.append('Welcome message NOT FOUND')

# ===== 3. Replace final buttons (mostrarBotoesFinais) =====
old_buttons = '''  async function mostrarBotoesFinais(clientId, limite) {
    hideInput();
    addMsg(
      '<div class="chat-options">'+
        '<button class="chat-option chat-option--primary" id="btnBaixarFim">📲 Baixar Aplicativo</button>'+
      '</div>',
      'bot'
    );
    document.getElementById('btnBaixarFim').onclick = function() {
      showDownloadModalInChat(clientId, limite);
    };
    await sleep(200);
    addMsg(
      '<div class="chat-options">'+
        '<button class="chat-option" id="btnSuporteFim">💬 Falar com um Atendente</button>'+
      '</div>',
      'bot'
    );'''

new_buttons = '''  async function mostrarBotoesFinais(clientId, limite) {
    hideInput();
    addMsg(
      '<div class="chat-options" style="gap:12px;">'+
        '<button class="chat-option chat-option--primary" id="btnBaixarFim" style="padding:18px;font-size:1rem;border-radius:14px;background:linear-gradient(135deg,#047857,#065F46);border:none;box-shadow:0 4px 16px rgba(4,120,87,0.25);">🟢 Baixar o aplicativo CredVale</button>'+
        '<button class="chat-option" id="btnSuporteFim" style="padding:18px;font-size:1rem;border-radius:14px;border:1.5px solid #3B82F6;color:#3B82F6;background:rgba(59,130,246,0.04);font-weight:700;">🔵 Falar com um especialista</button>'+
      '</div>',
      'bot'
    );'''

if old_buttons in content:
    content = content.replace(old_buttons, new_buttons)
    changes.append('Final buttons remodeled with Banese styling')
else:
    # Try alternative - the current content might be slightly different
    # Look for btnBaixarFim or btnSuporteFim in a simplified way
    if 'btnBaixarFim' in content:
        changes.append('Found btnBaixarFim but exact match failed - trying partial replacement')
    else:
        changes.append('Final buttons NOT FOUND')

# ===== 4. Replace plan offer popup title and badge =====
old_plan_badge = 'Mais Escolhido'
new_plan_badge = 'EXCLUSIVO CORRENTISTA BANESE'
if old_plan_badge in content:
    content = content.replace(old_plan_badge, new_plan_badge)
    changes.append('Plan badge: Mais Escolhido -> EXCLUSIVO CORRENTISTA BANESE')

# Replace old plan title
old_plan_title = 'Plano CredVale'
if 'Plano CredVale' in content:
    content = content.replace('Plano CredVale', 'Plano Exclusivo Banese')
    changes.append('Plan title: Plano CredVale -> Plano Exclusivo Banese')

# ===== 5. Replace plan description =====
old_plan_desc = 'Ideal para quem deseja economizar de verdade em saúde e medicamentos todos os meses.'
new_plan_desc = 'Plano exclusivo para correntistas Banese. Primeiros 6 meses sem cobrança.'
if old_plan_desc in content:
    content = content.replace(old_plan_desc, new_plan_desc)
    changes.append('Plan description updated')

# ===== 6. Replace plan button text =====
old_plan_btn = 'Assinar Plano CredVale'
new_plan_btn = 'Quero meu plano Banese'
if old_plan_btn in content:
    content = content.replace(old_plan_btn, new_plan_btn)
    changes.append('Plan button text updated')

# ===== 7. Chat top bar redesign =====
old_chat_brand = '<span>CREDVALE</span>'
new_chat_brand = '<span style="color:#047857;font-weight:800;">BANESE</span><span style="color:#10b981;font-weight:800;"> + </span><span>CREDVALE</span>'
if old_chat_brand in content:
    content = content.replace(old_chat_brand, new_chat_brand)
    changes.append('Chat brand: CREDVALE -> BANESE + CREDVALE')

# Save
with open('cadastro.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Changes made:')
for c in changes:
    print(f'  - {c}')
print(f'\nTotal: {len(changes)} changes')
