#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix remaining items: remove dead CSS, fix ultimos4, personalize welcome."""

# ===== 1. Fix cadastro.js - ultimos4 and welcome name =====
with open('cadastro.js', 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# Fix welcome - add nomePrimeiro back
old_parts = [
    ('font-size:1.3rem;font-weight:900;color:#047857;margin-bottom:4px;">Cadastro concluído com sucesso!</div>',
     'font-size:1.3rem;font-weight:900;color:#047857;margin-bottom:4px;">🎉 Cadastro concluído com sucesso, ' + ' + primeiroNome + ' + '!</div>'),
]

for old, new in old_parts:
    if old in content:
        content = content.replace(old, new)
        changes.append(f'Personalized welcome with first name')

# Fix ultimos4 in approval popup - use user.cpf.slice(-4) instead
old_ultimos = "String(ultimos4||'4589')"
new_ultimos = "(user.cpf||'').slice(-4)||'4589'"
if old_ultimos in content:
    content = content.replace(old_ultimos, new_ultimos)
    changes.append('ultimos4 now uses user.cpf.slice(-4)')

with open('cadastro.js', 'w', encoding='utf-8') as f:
    f.write(content)

# ===== 2. Fix cadastro-chat.css - remove dead CSS =====
with open('cadastro-chat.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Remove dead classes section
old_dead_css = """.banese-premium-card {
  margin: 16px auto;
  max-width: 300px;
}

.banese-premium-benefits {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  margin: 16px 0;
}

.banese-premium-benefit {
  display: flex;
  align-items: center;
  gap: 10px;
}

.banese-premium-benefit-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #047857;
  flex-shrink: 0;
}

.banese-premium-benefit-text {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
  line-height: 1.3;
}
"""

if old_dead_css in css_content:
    css_content = css_content.replace(old_dead_css, '')
    changes.append('Removed dead CSS classes (banese-premium-card, benefits, benefit, benefit-icon, benefit-text)')
else:
    changes.append('Dead CSS not found')
    
# Also remove .banese-premium-card if still a standalone
if '.banese-premium-card' in css_content:
    # Try to remove it standalone
    solo_card = ".banese-premium-card {\n  margin: 16px auto;\n  max-width: 300px;\n}\n\n"
    if solo_card in css_content:
        css_content = css_content.replace(solo_card, '')
        changes.append('Removed standalone .banese-premium-card')

with open('cadastro-chat.css', 'w', encoding='utf-8') as f:
    f.write(css_content)

print("Final fixes:")
for c in changes:
    print(f"  - {c}")
