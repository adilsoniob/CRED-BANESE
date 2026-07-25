# PROMPT PARA AGENTE — Reformular Landing Page Banese + CredVale

## Objetivo
Reformular COMPLETAMENTE a cópia (texto) da landing page (`src/App.tsx`) para apresentar a **parceria oficial Banese + CredVale**. Manter EXATAMENTE a mesma estrutura de seções, componentes, imagens e elementos visuais. Apenas o **texto** deve ser alterado.

## Paleta de Cores (Identidade Visual)
- **Verde escuro maduro (#022c22, #064E3B, #065F46, #047857)** — tom principal, sóbrio e institucional
- **Azul (#0B6CF4)** — como cor de apoio/accent em badges e detalhes menores
- **Branco (#ffffff)** — fundo das seções de conteúdo
- **Cinza claro (#F7FAFC, #F8FAFC)** — fundos alternados
- **Texto escuro (#1F2937, #374151, #4B5563)** — legibilidade
- **Verde claro (#10B981, #34D399)** — apenas para badges de destaque e ícones de check

## Estrutura (MANTER IGUAL)
Manter todas as seções na mesma ordem e com os MESMOS elementos visuais:

1. **Status Bar** — Manter igual, trocar cor para verde escuro
2. **Header** — Manter logotipo, botões "Acessar" e "Quero meu benefício"
3. **Hero Section** — Fundo gradiente verde escuro, badge, título, subtítulo, tags de benefícios, card SVG Banese, pricing, CTAs, disclaimer
4. **Benefícios Rápidos** — Grid 2x2 com ícones + lista de checkmarks
5. **Farmácias Parceiras** — Carrossel de imagens (manter imagens FARMI1.webp e FARMI2.webp)
6. **Aplicativo** — Imagem app-2.webp, lista de funcionalidades, botão download
7. **Vantagens** — Grid 2x2 com ícones
8. **Plano** — Card de preço, badge "Exclusivo", lista de benefícios, CTA
9. **CTA Final** — Fundo verde escuro, texto, CTA
10. **Footer** — Informações da empresa, links
11. **Security Popup** — Manter igual
12. **Download Modal** — Manter igual
13. **CPF Modal** — Manter igual

## Imagens (MANTER)
- `/assets/logo-app.png` — logotipo
- `/assets/hero222.webp` — imagem principal (NÃO TROCAR, o usuário trocará depois)
- `/assets/FARMI1.webp` — carrossel farmácias
- `/assets/FARMI2.webp` — carrossel farmácias
- `/assets/app-2.webp` — screenshot do app

## CÓPIA NOVA — Substituir 100% dos textos

### 1. HEADER
- Logotipo: **BANESE + CREDVALE** (ícone com iniciais B e CV)
- Texto do logotipo: **"CredVale"** com subtítulo **"Parceiro Banese"**
- Botão 1: **"Acessar"** (ícone de login) — abre modal CPF
- Botão 2: **"Quero meu benefício"** (fundo verde escuro) — redireciona para cadastro com flag `credvale_banese`

### 2. HERO
- Badge: **"Exclusivo para clientes Banese"**
- Título principal: **"Sua saúde agora vale ainda mais."**
- Marcas: **BANESE + CREDVALE** (com ícone de soma entre elas)
- Parágrafo: *"Há mais de 10 anos, a CredVale leva economia, praticidade e segurança para milhares de brasileiros. Agora, em parceria com o Banese, você tem acesso a benefícios exclusivos, com ainda mais vantagens para cuidar da sua saúde e do seu bolso."*
- Tags:
  - 💊 **"Até 75% OFF em medicamentos"**
  - 💳 **"Limite de até R$ 10.000"**
- Card SVG Banese (já existe função `gerarCardBaneseSVG()`)
- Pricing Card:
  - **R$ 0,99/mês**
  - *"6 meses de isenção para novos clientes Banese"*
- CTA 1: **"🟢 Quero meu benefício Banese"** (fundo verde claro) → `goToCadastroBanese()`
- CTA 2: **"Já tenho conta"** (link) → `openCpfModal()`
- Disclaimer: *"*Limite sujeito à análise de crédito."*

### 3. BENEFÍCIOS RÁPIDOS
- Badge: **"Benefícios exclusivos"**
- Título: **"Para quem é cliente Banese"**
- Grid 2x2:
  1. 💳 **Cartão de Crédito** — Limite de até R$ 10.000*
  2. 💊 **Convênio Farmacêutico** — Apenas R$ 0,99/mês
  3. ❤️ **Isenção** — 6 meses sem pagar
  4. 📈 **Análise rápida** — ~2 minutos
- Checkmarks:
  - ✅ Até 75% de desconto em medicamentos
  - ✅ Mais de 45 mil farmácias credenciadas
  - ✅ Benefício exclusivo correntistas Banese
- Disclaimer: *"*Sujeito à análise de crédito."*

### 4. FARMÁCIAS PARCEIRAS
- Badge: **"Grandes Marcas"**
- Título: **"Mais de 45 mil farmácias parceiras em todo o Brasil"**
- Subtítulo: *"Com a parceria Banese + CredVale, você economiza nas maiores redes de farmácias do país e em milhares de estabelecimentos credenciados."*
- Badge extra: **"Até 75% OFF em medicamentos"** (verde escuro)

### 5. APLICATIVO
- Badge: **"Aplicativo"**
- Título: **"Toda a praticidade na palma da sua mão."**
- Subtítulo: *"Com o aplicativo CredVale você pode acessar seu cartão digital, consultar seu limite disponível, acompanhar seus benefícios, localizar farmácias credenciadas e visualizar descontos exclusivos."*
- Lista de funcionalidades:
  - ✅ Cartão digital sempre disponível
  - ✅ Limite e benefícios em tempo real
  - ✅ Localizador de farmácias credenciadas
- CTA: **"Baixar o aplicativo grátis"** → abre modal de download

### 6. VANTAGENS
- Badge: **"Vantagens Reais"**
- Título: **"Por que milhares de clientes escolhem a CredVale?"**
- Subtítulo: *"Há mais de 10 anos, oferecemos soluções para quem busca economia e praticidade. Agora, com a parceria Banese, os benefícios ficaram ainda maiores."*
- Grid 2x2:
  1. 💊 **75% OFF em medicamentos** — Economize nas maiores redes de farmácias do Brasil.
  2. 💳 **Cartão de crédito até R$ 10.000** — Mais flexibilidade para organizar suas compras.
  3. 📍 **Mais de 45 mil farmácias** — Uma ampla rede de atendimento em todo o país.
  4. 📱 **App completo** — Cartão digital, benefícios, parceiros e muito mais.
  5. 📞 **Atendimento humanizado** — Equipe especializada pronta para ajudar sempre que você precisar.
  6. ⭐ **Benefícios exclusivos Banese** — Condições especiais que você encontra somente nesta parceria.

### 7. PLANO
- Badge: **"Condição Exclusiva"**
- Título: **"Plano Banese + CredVale"**
- Card de preço:
  - Badge: **"Exclusivo"** (verde escuro, canto superior direito)
  - Riscado: *"De R$ 26,99"*
  - Preço: **R$ 0,99/mês**
  - Badge: **"Você economiza 96%"**
- Destaque: 🎁 **Primeiros 6 meses gratuitos** — Depois, apenas R$ 0,99/mês
- Lista de inclusos:
  - ✅ Até 75% OFF em medicamentos
  - ✅ Cartão com limite de até R$ 10.000
  - ✅ Rede com mais de 45 mil farmácias
  - ✅ Aplicativo CredVale completo
  - ✅ Benefícios exclusivos para clientes Banese
- CTA: **"Quero garantir meu benefício"** (verde escuro) → `goToCadastroBanese()`

### 8. CTA FINAL (Encerramento)
- Badge: **"Banese + CredVale"**
- Título:
  ```
  Mais economia para sua saúde.
  Mais benefícios para a sua vida.
  ```
- Subtítulo: *"Há mais de uma década cuidando da saúde financeira e do bem-estar dos brasileiros. A CredVale construiu uma história baseada em confiança, economia e inovação. Agora, junto ao Banese, oferece uma experiência ainda mais completa para seus correntistas."*
- CTA: **"Quero meu Cartão CredVale"** (botão branco com texto verde escuro) → `goToCadastroBanese()`

### 9. FOOTER
- Logotipo: **CredVale** com selo **"Parceiro Banese"**
- Razão social: CredVale Intermediação de Serviços de Saúde Ltda.
- CNPJ: 42.109.873/0001-92
- Endereço: Av. Paulista, 1000, Bela Vista, São Paulo - SP
- Telefone: 0800 591 0233
- E-mail: contato@credvale.com.br
- Links: Admin | Política de Privacidade | Termos de Uso
- Copyright: © 2026 CredVale

### 10. SECURITY POPUP
- Manter 100% igual — aviso de segurança institucional
- Apenas trocar cor do botão para verde escuro

### 11. DOWNLOAD MODAL
- Manter 100% igual — fluxo de download do APK
- Apenas trocar cor do botão para verde escuro

### 12. CPF MODAL
- Manter 100% igual — consulta de CPF
- Apenas trocar cor do botão para verde escuro e ícones para verde

## Funções Nova vs Existente
- Manter função `gerarCardBaneseSVG()` — já existe em `src/App.tsx`
- Manter função `goToCadastroBanese()` — já existe, seta `sessionStorage.setItem('credvale_banese', 'true')`
- Manter função `goToCadastro()` — para fluxo normal
- Manter função `openCpfModal()` — para consulta de CPF

## Observações Técnicas
1. Não remover ou alterar imports de componentes (WhatsAppButton, motion, AnimatePresence, lucide-react)
2. Não alterar classes CSS de layout (as classes Tailwind definem o grid, padding, etc.)
3. Valor do limite máximo: sempre **R$ 10.000** (nunca R$ 5.000)
4. Preço do plano: sempre **R$ 0,99/mês** (nunca R$ 1,66)
5. Farmácias: sempre **45 mil** (nunca 15 mil)
6. Oferta especial: **6 meses de isenção** para clientes Banese
7. Empresa: **Há mais de 10 anos**

## Foco na Conversão
A página deve transmitir:
- **Seriedade** — tom institucional, cores escuras e maduras
- **Parceria oficial** — Banese + CredVale lado a lado em todas as seções
- **Exclusividade** — benefícios APENAS para correntistas Banese
- **Urgência** — condição especial, oferta limitada
- **Credibilidade** — números reais, descontos reais, parceria real
