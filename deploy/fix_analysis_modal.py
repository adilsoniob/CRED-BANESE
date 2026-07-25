#!/usr/bin/env python3
"""Replace etapaIntroAnalise function: more concise steps, slower timing, premium design."""

with open('cadastro.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_start = '  /* ---- POPUP DE INTRODUÇÃO DA ANÁLISE ---- */'
new_start = '  /* ---- POPUP DE INTRODUÇÃO DA ANÁLISE (Premium Banese) ---- */'

# Find the old function boundaries
idx_start = content.find(old_start)
if idx_start < 0:
    print("ERROR: Could not find old function start marker")
    exit(1)

# The function ends right before "  /* ---- POPUP DE APROVAÇÃO ---- */" or similar
# Find the next line that starts with "  /* ----" after the function
idx_func_end = content.find('\n  /* ----', idx_start + 1)
if idx_func_end < 0:
    print("ERROR: Could not find end of function")
    exit(1)

# Actually, let me find the specific end: the line with "etapaAnalisePopup();"
idx_call = content.find('etapaAnalisePopup();', idx_start)
if idx_call < 0:
    print("ERROR: Could not find etapaAnalisePopup() call")
    exit(1)

# After the function, find the closing of the IFFE or the next function
# Let's find the next function or section marker after the closing brace of etapaIntroAnalise
idx_after = content.find('\n  }\n\n  /* ----', idx_call)
if idx_after < 0:
    # Try alternative pattern
    idx_after = content.find('\n  }\n\n  async function', idx_call)

if idx_after < 0:
    print("ERROR: Could not find end of etapaIntroAnalise function")
    exit(1)

old_func = content[idx_start:idx_after]

# New function
new_func = '''  /* ---- POPUP DE INTRODUÇÃO DA ANÁLISE (Premium Banese) ---- */
  async function etapaIntroAnalise() {
    var nome = (user.nome||'').split(' ')[0] || 'Cliente';
    // Etapas enxutas da an\\u00e1lise
    var etapas = user.isBanese ? [
      { label: 'Validando CPF', icon: '\\u2705' },
      { label: 'Analisando cr\\u00e9dito e perfil', icon: '\\u23F3' },
      { label: 'Verificando elegibilidade Banese', icon: '\\u23F3' },
      { label: 'Calculando limite dispon\\u00edvel', icon: '\\u23F3' },
      { label: 'Preparando resultado', icon: '\\u23F3' }
    ] : [
      { label: 'Validando CPF', icon: '\\u2705' },
      { label: 'Analisando dados cadastrais', icon: '\\u23F3' },
      { label: 'Calculando limite', icon: '\\u23F3' },
      { label: 'Preparando resultado', icon: '\\u23F3' }
    ];
    var isPremium = user.isBanese ? true : false;
    var gradFrom = isPremium ? '#022c22' : '#0B6CF4';
    var gradTo = isPremium ? '#065F46' : '#059669';
    var shadowColor = isPremium ? 'rgba(4,120,87,0.25)' : 'rgba(11,108,244,0.2)';
    var html =
      '<div style="text-align:center;padding:12px 0 4px;">'+
        '<div style="width:60px;height:60px;border-radius:18px;background:linear-gradient(135deg,'+gradFrom+','+gradTo+');display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:0 6px 20px '+shadowColor+';">'+
          '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+
            '<path d="M12 2L2 7l10 5 10-5-10-5z"/>'+
            '<path d="M2 17l10 5 10-5"/>'+
            '<path d="M2 12l10 5 10-5"/>'+
          '</svg>'+
        '</div>'+
        '<div class="popup-title" style="font-size:1.15rem;font-weight:800;color:#0f172a;">'+nome+', estamos analisando</div>'+
        '<div class="popup-subtitle" style="font-size:0.82rem;color:#64748b;margin-top:4px;">An\\u00e1lise em andamento — leva poucos instantes</div>'+
        '<div class="popup-step-list" id="analysisStepList" style="margin:18px 0 8px;text-align:left;">'+
          etapas.map(function(e, i){
            return '<div class="popup-step-item" data-idx="'+i+'" style="padding:9px 14px;border-radius:10px;margin-bottom:6px;background:#f8fafc;border:1px solid #e2e8f0;transition:all 0.4s ease;">'+
              '<div class="popup-step-icon" id="asi'+i+'" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#e2e8f0;color:#475569;font-size:12px;font-weight:700;margin-right:10px;transition:all 0.4s ease;">'+(i+1)+'</div>'+
              '<span id="ast'+i+'" style="font-size:0.85rem;color:#475569;font-weight:500;transition:color 0.4s ease;">'+e.label+'</span>'+
            '</div>';
          }).join('')+
        '</div>'+
        '<div class="popup-progress-bar" style="margin:12px auto 4px;max-width:200px;height:5px;border-radius:10px;background:#e2e8f0;overflow:hidden;">'+
          '<div class="popup-progress-fill" id="analysisProgressFill" style="width:0%;height:100%;border-radius:10px;background:linear-gradient(90deg,'+gradFrom+','+gradTo+');transition:width 0.6s ease;"></div>'+
        '</div>'+
        '<div style="font-size:0.72rem;color:#94a3b8;margin-top:10px;font-weight:500;" id="analysisStatusText">Iniciando an\\u00e1lise...</div>'+
      '</div>';
    showPopup(html);
    var bx = document.querySelector('.popup-box');
    if (bx) { bx.style.maxWidth = '400px'; bx.style.borderRadius = '20px'; bx.style.padding = '24px'; }
    var fill = document.getElementById('analysisProgressFill');
    var statusText = document.getElementById('analysisStatusText');
    for (var i = 0; i < etapas.length; i++) {
      var item = document.querySelector('.popup-step-item[data-idx="'+i+'"]');
      var icon = document.getElementById('asi'+i);
      if (item) {
        item.style.borderColor = gradFrom;
        item.style.background = isPremium ? 'rgba(4,120,87,0.06)' : 'rgba(11,108,244,0.06)';
        item.classList.add('popup-step-item--active');
        if (icon) {
          icon.style.background = isPremium ? '#047857' : '#0B6CF4';
          icon.style.color = '#ffffff';
          icon.textContent = '\\u21BB';
        }
      }
      if (statusText) statusText.textContent = etapas[i].label + '...';
      // Mais lento: 1.3s a 2.1s por etapa
      await sleep(1300 + Math.floor(Math.random()*800));
      if (item) {
        if (i < etapas.length-1) {
          item.style.borderColor = '#d1d5db';
          item.style.background = '#f1f5f9';
          item.classList.remove('popup-step-item--active');
        }
        item.classList.add('popup-step-item--done');
        if (icon) {
          icon.style.background = isPremium ? '#047857' : '#0B6CF4';
          icon.textContent = '\\u2713';
        }
      }
      if (fill) fill.style.width = Math.round((i+1)/etapas.length*100)+'%';
    }
    if (statusText) statusText.textContent = '\\u2705 Conclu\\u00eddo!';
    if (fill) fill.style.width = '100%';
    await sleep(1000);
    closePopup();
    await sleep(300);
    etapaAnalisePopup();
  }'''

if old_func in content:
    content = content.replace(old_func, new_func, 1)
    with open('cadastro.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ etapaIntroAnalise replaced successfully!")
else:
    print("ERROR: Could not find exact match for old function")
    print(f"Found old_start at index {idx_start}")
    print(f"Found idx_after at index {idx_after}")
    print(f"Old function length: {len(old_func)}")
    # Show a snippet for debugging
    print(f"First 100 chars of old_func: {repr(old_func[:100])}")
    print(f"First 100 chars at content[idx_start]: {repr(content[idx_start:idx_start+100])}")
