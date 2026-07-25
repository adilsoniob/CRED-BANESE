#!/usr/bin/env python3
"""Make etapaBaneseModal more compact/smaller."""

import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('cadastro.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_start = '  /* ---- MODAL PREMIUM BANESE (tela quase inteira, fundo branco, elegante) ---- */'
new_comment = '  /* ---- MODAL PREMIUM BANESE (compacto) ---- */'

idx_start = content.find(old_start)
if idx_start < 0:
    print("ERROR: old_start not found")
    exit(1)

idx_func_end = content.find('\n  window._iniciarChat', idx_start)
if idx_func_end < 0:
    print("ERROR: func end not found")
    exit(1)

old_func = content[idx_start:idx_func_end]

new_func = '''  /* ---- MODAL PREMIUM BANESE (compacto) ---- */
  async function etapaBaneseModal() {
    flowState = 'banese_modal';
    hideInput();
    var baneseHtml = 
      '<div class="banese-premium-modal" style="padding:16px;">'+
        '<div class="banese-premium-header" style="margin-bottom:6px;">'+
          '<div class="banese-premium-logos" style="gap:6px;">'+
            '<div class="banese-premium-logo">'+
              '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#022c22,#065F46);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:900;letter-spacing:1px;box-shadow:0 2px 8px rgba(4,120,87,0.2);">BAN</div>'+
            '</div>'+
            '<div style="font-size:16px;color:#d1d5db;font-weight:300;">+</div>'+
            '<div class="banese-premium-logo">'+
              '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#047857,#10b981);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:900;box-shadow:0 2px 8px rgba(16,185,129,0.2);">CV</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div style="text-align:center;margin:4px 0 6px;">'+
          '<div style="display:inline-block;background:rgba(4,120,87,0.08);padding:3px 12px;border-radius:50px;font-size:10px;font-weight:700;color:#047857;letter-spacing:0.3px;">EXCLUSIVO CORRENTISTA BANESE</div>'+
        '</div>'+
        '<div class="banese-premium-content">'+
          '<div class="banese-premium-title" style="font-size:1.15rem;margin-bottom:4px;">Excelente! \\ud83c\\udf89</div>'+
          '<div style="font-size:0.8rem;color:#475569;text-align:center;margin-bottom:8px;line-height:1.4;">'+
            'Voc\\u00ea acaba de acessar as <strong>condi\\u00e7\\u00f5es exclusivas</strong> da parceria Banese + CredVale.'+
          '</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;">'+
            '<div style="background:rgba(4,120,87,0.06);border-radius:8px;padding:6px 10px;font-size:0.78rem;color:#1F2937;">\\ud83d\\udcb0 <strong>At\\u00e9 R$10.000</strong></div>'+
            '<div style="background:rgba(4,120,87,0.06);border-radius:8px;padding:6px 10px;font-size:0.78rem;color:#1F2937;">\\ud83d\\udc8a <strong>At\\u00e9 75% OFF</strong></div>'+
            '<div style="background:rgba(4,120,87,0.06);border-radius:8px;padding:6px 10px;font-size:0.78rem;color:#1F2937;">\\ud83c\\udf89 <strong>6 meses gr\\u00e1tis</strong></div>'+
            '<div style="background:rgba(4,120,87,0.06);border-radius:8px;padding:6px 10px;font-size:0.78rem;color:#1F2937;">\\ud83c\\udfaf <strong>~2 minutos</strong></div>'+
          '</div>'+
          '<div style="font-size:0.78rem;color:#475569;background:rgba(4,120,87,0.06);padding:8px 12px;border-radius:10px;border-left:3px solid #047857;text-align:left;margin-bottom:8px;line-height:1.4;">'+
            'Agora vamos confirmar algumas informa\\u00e7\\u00f5es para continuar seu cadastro.'+
          '</div>'+
        '</div>'+
        '<button class="banese-premium-cta" id="banesePremiumContinue" style="padding:10px 0;font-size:0.9rem;">Continuar</button>'+
      '</div>';

    showPopup(baneseHtml);
    var bx = document.querySelector('.popup-box');
    if (bx) bx.classList.add('popup-box--premium');
    var ov = document.querySelector('.popup-overlay');
    if (ov) ov.classList.add('popup-overlay--light');

    document.getElementById('banesePremiumContinue').onclick = function() {
      closePopup();
      user.isBanese = true;
      addMsg('\\u2705 <strong>Benef\\u00edcio Banese confirmado!</strong>', 'bot');
      addMsg('Vamos confirmar seus dados. <strong>Informe seu CPF</strong> para continuar.');
      etapaCPF(true);
    };
  }'''

if old_func not in content:
    print("ERROR: old_func not found in content")
    print(f"Looking for: {repr(old_func[:200])}")
    exit(1)

content = content.replace(old_func, new_func, 1)
with open('cadastro.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ etapaBaneseModal replaced successfully!")
