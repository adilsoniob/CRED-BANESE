#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix remaining items: welcome message and credential validation."""

import re

with open('cadastro.js', 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# ===== Fix 1: Welcome message =====
# Find the exact welcome block by looking for the unique patterns
idx_seja = content.find('Seja bem-vindo(a)')
if idx_seja >= 0:
    # Find the start of the addMsg block - search backwards for 'addMsg('
    addmsg_start = content.rfind("addMsg(", 0, idx_seja)
    # Find the end - search for ",'bot');" after this
    idx_bot = content.find("'bot'", idx_seja)
    idx_semicolon = content.find(");", idx_bot)
    
    if addmsg_start >= 0 and idx_semicolon >= 0:
        idx_end = idx_semicolon + 2
        old_welcome = content[addmsg_start:idx_end]
        
        new_welcome = '''    addMsg(
      '<div style="text-align:center;padding:8px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;">' +
          '<div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#022c22,#065F46);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(4,120,87,0.25);">' +
            '<span style="font-size:1.8rem;">🎉</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:1.3rem;font-weight:900;color:#047857;margin-bottom:4px;">Cadastro concluído com sucesso!</div>' +
        '<div style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:8px;">Seu acesso está sendo preparado.</div>' +
        '<div style="font-size:0.85rem;color:#475569;line-height:1.6;margin-bottom:8px;">' +
          'Enquanto isso você já pode baixar o aplicativo ou falar com um especialista para começar a aproveitar todos os seus benefícios.' +
        '</div>' +
      '</div>',
      'bot'
    );'''
        
        content = content[:addmsg_start] + new_welcome + content[idx_end:]
        changes.append('Welcome message replaced successfully')
    else:
        changes.append('Could not find welcome boundaries')
else:
    changes.append('Seja bem-vindo not found')

# ===== Fix 2: Credential validation =====
# Find the btnCadastrarCredenciais onclick handler and add password strength listener before it
idx_btn_line = content.find("document.getElementById('btnCadastrarCredenciais').onclick")
if idx_btn_line >= 0:
    # Insert password strength listener before the onclick
    pw_listener = """    document.getElementById('credPassword').addEventListener('input', function() {
      var val = this.value.replace(/\\D/g, '');
      this.value = val;
      var len = val.length;
      var ps1 = document.getElementById('ps1');
      var ps2 = document.getElementById('ps2');
      var ps3 = document.getElementById('ps3');
      if (ps1) ps1.style.background = len >= 1 ? '#f59e0b' : '#e2e8f0';
      if (ps2) ps2.style.background = len >= 3 ? '#f59e0b' : '#e2e8f0';
      if (ps3) ps3.style.background = len >= 5 ? '#10B981' : '#e2e8f0';
    });
    document.getElementById('credConfirmPassword').addEventListener('input', function() {
      this.value = this.value.replace(/\\D/g, '');
    });
    """
    content = content[:idx_btn_line] + pw_listener + content[idx_btn_line:]
    changes.append('Password strength JS added before credential onclick')
else:
    changes.append('btnCadastrarCredenciais onclick not found')

# Save
with open('cadastro.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Changes:")
for c in changes:
    print(f"  - {c}")
