# 🏦 CREDVALE + BANESE

Sistema completo de gestão de **cartão de benefícios de saúde** em parceria com o **Banese (Banco do Estado de Sergipe)**.

Oferece descontos em medicamentos (até **75% OFF**) em mais de **45 mil farmácias** credenciadas em todo o Brasil, com cartão de crédito de até **R$ 10.000** e planos a partir de **R$ 0,99/mês**.

---

## 📋 Índice

- [Stack](#-stack)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como executar localmente](#-como-executar-localmente)
- [Deploy](#-deploy)
  - [EdgeOne](#edgeone)
  - [Railway](#railway)
  - [Completo](#deploy-completo)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [API Routes](#-api-routes)

---

## 🧬 Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend (Landing Page)** | React 19 + TypeScript + Vite 6 |
| **Estilo** | Tailwind CSS 4 + Motion + CSS custom |
| **Frontend (Cadastro/Admin)** | Vanilla JS (HTML/CSS puro) |
| **Backend** | Node.js + Express 4 |
| **Banco de Dados** | SQLite (sql.js) |
| **Deploy Frontend** | EdgeOne Makers |
| **Deploy Backend** | Railway |

---

## 📁 Estrutura do Projeto

```
CRED-BANESE/
├── index.html              → Landing page principal (React SPA)
├── cadastro.html           → Fluxo de cadastro conversacional
├── cliente.html            → Área do cliente (dashboard mobile)
├── admin.html              → Painel administrativo
├── app.html                → Página de download do app
│
├── src/                    → Fonte React (landing page)
│   ├── App.tsx             → Componente principal
│   ├── main.tsx            → Entry point
│   ├── index.css           → Estilos globais
│   └── components/
│       └── WhatsAppButton.tsx
│
├── frontend/js/
│   └── api.js              → API Client (JS puro)
│
├── backend/
│   ├── server.js           → Servidor Express
│   ├── src/
│   │   ├── database.js     → SQLite (init, migrations, queries)
│   │   ├── middleware/
│   │   │   ├── auth.js     → JWT + permissões
│   │   │   └── rate-limiter.js
│   │   ├── routes/         → 13 módulos de rota
│   │   │   ├── auth.js     → Login admin
│   │   │   ├── clients.js  → CRUD clientes
│   │   │   ├── payments.js → PIX + Cartão
│   │   │   └── ...
│   │   └── services/
│   │       └── sms-panel.js → Integração TopYing SMS
│   └── package.json
│
├── admin-panel/
│   ├── admin.js → Painel admin completo
│   └── admin.css
│
├── deploy.cjs              → Script de deploy EdgeOne + Git
├── railway.json             → Configuração Railway
├── vite.config.ts           → Vite config
└── tsconfig.json            → TypeScript config
```

---

## 🚀 Como executar localmente

### Pré-requisitos

- Node.js 18+
- npm

### Instalação

```bash
# Instalar dependências do projeto principal
npm install

# Instalar dependências do backend
cd backend
npm install
cd ..
```

### Executar em desenvolvimento

```bash
# Inicia o Vite dev server na porta 3000
npm run dev
```

Em outro terminal, inicie o backend:

```bash
node backend/server.js
```

O servidor estará disponível em `http://localhost:3000`.

### Build de produção

```bash
npm run build
```

Gera os arquivos em `dist/` e copia assets estáticos para a raiz.

---

## ☁️ Deploy

O projeto possui dois ambientes de deploy:

### EdgeOne

Para deploy apenas no **EdgeOne Makers** (frontend), execute:

```bash
npm run deploy
```

Ou diretamente:

```bash
node deploy.cjs
```

O script `deploy.cjs` executa automaticamente:

| Etapa | Descrição |
|-------|-----------|
| 1. 🧹 **Clean** | Remove artifacts de build antigos |
| 2. 🔨 **Build** | Compila o frontend (Vite + React) |
| 3. 🔖 **Cache-bust** | Atualiza versão nos `?v=` dos HTMLs |
| 4. 📂 **Sync** | Copia assets para `.edgeone/assets/` |
| 5. ☁️ **Deploy** | `edgeone makers deploy --name credvale` |
| 6. 📤 **Git push** | Commita e envia para GitHub |

**URL do EdgeOne:** [https://credvale.edgeone.run](https://credvale.edgeone.run)

### Railway

O backend roda no **Railway**. O projeto já está linkado via CLI.

```bash
# Deploy direto via CLI (envia o código atual)
railway up
```

Ou configure o **auto-deploy** conectando o repositório GitHub ao Railway:
1. Acesse [railway.com](https://railway.com)
2. Vá em **Dashboard** → **adaptable-vision**
3. Conecte o repositório `adilsoniob/CRED-BANESE`
4. Configure a branch `main` para auto-deploy

### Deploy Completo

```bash
# EdgeOne + Git push (e Railway se auto-deploy estiver configurado)
npm run deploy
```

---

## 🔐 Variáveis de Ambiente

### Backend (`.env` na raiz)

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `PORT` | Porta do servidor (default: 3000) | ❌ |
| `JWT_SECRET` | Chave secreta JWT | ❌ (default: `vale-saude-secret`) |
| `JWT_EXPIRES_IN` | Tempo de expiração JWT (default: `8h`) | ❌ |
| `DB_PATH` | Caminho do banco SQLite | ❌ |
| `CORS_ORIGIN` | Origens CORS permitidas (separadas por vírgula) | ❌ |
| `NODE_ENV` | Ambiente (`production`, `development`) | ❌ |
| `RAILWAY_API` | URL da API Railway para fallback CPF | ❌ |
| `PANEL_BASE_URL` | URL do painel SMS TopYing | ❌ |
| `PANEL_TIMEOUT_MS` | Timeout do painel SMS (default: 20000) | ❌ |
| `SMS_ACCOUNT_1..4` | Credenciais de contas SMS | ❌ |
| `SMS_PASSWORD_1..4` | Senhas das contas SMS | ❌ |

---

## 📡 API Routes

| Rota | Descrição |
|------|-----------|
| `GET /api/health` | Health check |
| `POST /api/auth/login` | Login admin |
| `GET /api/auth/me` | Usuário atual |
| `GET/POST /api/clients` | CRUD clientes |
| `GET /api/clients/:id` | Detalhes do cliente |
| `PATCH /api/clients/:id/status` | Alterar status |
| `GET /api/products` | Listar produtos |
| `GET /api/products/plans` | Listar planos |
| `POST /api/requests` | Criar solicitação |
| `GET /api/payments/config` | Config de pagamento |
| `POST /api/payments/generate-pix` | Gerar PIX |
| `GET /api/admin/dashboard` | Dashboard KPIs |
| `GET /api/admin/settings` | Configurações |
| `POST /api/client-area/login` | Login cliente |
| `POST /api/cpf/consult` | Consultar CPF (HydraCPF) |
| `POST /api/track/page-view` | Rastrear visita |
| `POST /api/admin/sms/panel/send` | Enviar SMS manual |

---

## 🗄️ Banco de Dados (SQLite)

Principais tabelas:

| Tabela | Descrição |
|--------|-----------|
| `users` | Admin/operadores do sistema |
| `clients` | Clientes (23+ colunas) |
| `requests` | Solicitações de cadastro |
| `payments` | Pagamentos (PIX/cartão) |
| `products` | Produtos (virtual/físico) |
| `plans` | Planos (básico/premium) |
| `sessions` | Sessões de rastreamento |
| `settings` | Configurações chave-valor |
| `logs` | Logs de auditoria |
| `sms_history` | Histórico de SMS |
| `sms_accounts` | Contas TopYing SMS |
| `page_views` | Visitas à landing page |

---

## 🔑 Credenciais Padrão (Admin)

| E-mail | Senha | Nível |
|--------|-------|-------|
| `admin@valesaude.com.br` | `admin123` | Admin |
| `operador@valesaude.com.br` | `admin123` | Operador |
| `suporte@valesaude.com.br` | `admin123` | Suporte |

⚠️ **Altere as senhas em produção!**

---

## 📄 Licença

Proprietário — CredVale Intermediação de Serviços de Saúde Ltda.
