<p align="center">
  <img src="packages/frontend/public/chewie.jpg" alt="Weekly Wallet" width="120" style="border-radius: 50%;" />
</p>

<h1 align="center">🐱 Weekly Wallet</h1>

<p align="center">
  <strong>A personal finance tracker with weekly budgeting, monthly planning, and end-to-end encryption.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Hono-3-E36002?logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/R2_Storage-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare R2" />
</p>

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Dashboard** | KPIs (weekly balance, cash runway), bar chart for weekly goals, cumulative trend line, and category donut chart |
| 📅 **Monthly Planning** | Set salary, define budget categories (weekly/monthly frequency), track credit vs. spend types |
| 🗂️ **Week Cards** | Swipeable carousel of weekly expense cards with real-time balance tracking |
| ➕ **Add Expense** | Quick-add modal with category picker, credit/expense toggle, and installment splitting across weeks |
| 💰 **Savings Tracker** | Aggregates budgeted savings + expense-tagged savings deposits |
| 🔐 **E2E Encryption** | All user data encrypted at rest with AES-256-GCM; DEK wrapped per-user |
| 🤖 **Telegram Bot** | Link your account to receive password-reset codes and notifications via `@WeeklyWalletBot` |
| 🩺 **Monitor Worker** | Daily health check (cron) that tests endpoints, CORS, SSL, and Telegram bot — sends a report to the owner |

---

## 🏗️ Architecture

```
weekly-wallet/                   ← npm workspaces monorepo
├── packages/
│   ├── frontend/                ← React + Vite (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── components/      ← Dashboard, WeekCarousel, AddExpenseModal, MonthlyPlanningModal, LoginPage
│   │   │   ├── lib/             ← api.js, AuthContext.jsx, utils.js
│   │   │   └── styles/          ← Vanilla CSS with warm Weekly theme
│   │   └── vite.config.js
│   │
│   ├── backend/                 ← Hono on Cloudflare Workers
│   │   └── src/
│   │       ├── index.js         ← API routes (weeks, monthly-planning, telegram webhook)
│   │       ├── auth.js          ← Register, login, JWT, password reset via Telegram
│   │       ├── crypto.js        ← AES-256-GCM encryption, key derivation & wrapping
│   │       └── middleware.js    ← JWT auth middleware
│   │
│   └── monitor/                 ← Cloudflare Worker (Cron Trigger)
│       └── src/
│           └── index.js         ← Health checks + Telegram report
```

### Data Flow

```
Browser ──JWT──▶ Cloudflare Worker (Hono)
                     │
                     ├─ derive DEK per user
                     ├─ AES-256-GCM encrypt/decrypt
                     └─ R2 Object Storage
                          └─ {userId}/weeks-data.json
                          └─ {userId}/monthly-planning-YYYY-MM.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 5, Recharts, Framer Motion, Lucide Icons, date-fns |
| **Backend** | Hono 3, Cloudflare Workers, R2 Storage |
| **Auth** | JWT + Bcrypt (scrypt via Web Crypto), AES-256-GCM per-user encryption |
| **Bot** | Telegram Bot API (webhook-based) |
| **Monitor** | Cloudflare Cron Triggers (daily at 08:00 UTC) |
| **Deployment** | Cloudflare Pages (frontend) + Cloudflare Workers (backend & monitor) |
| **Fonts** | Inter, Orbitron (via Google Fonts) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (workspaces support)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for backend/monitor deployment

### Install

```bash
git clone https://github.com/rzb1414/weekly-wallet.git
cd weekly-wallet
npm install
```

### Run Frontend (dev)

```bash
npm run dev --workspace=packages/frontend
# → http://localhost:5173
```

### Run Backend (dev)

```bash
npm run start --workspace=packages/backend
# → http://localhost:8787
```

### Environment Variables

#### Root (`.env`)

Used by worker deploy commands so Wrangler always authenticates with the intended Cloudflare account.

```env
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=a928f4bf274d697272e1ddf90cb49798
```

#### Backend (`packages/backend` — Wrangler Secrets)

| Secret | Description |
|---|---|
| `JWT_SECRET` | Signing key for JWT tokens + recovery key derivation |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token |

#### Frontend (`packages/frontend/.env`)

```env
VITE_API_URL=http://localhost:8787/api    # local dev
```

---

## 📦 Deployment

| Service | Platform | Deploy |
|---|---|---|
| Frontend | Cloudflare Pages | `npm run build` → Pages dashboard or `wrangler pages deploy dist` |
| Backend | Cloudflare Workers | `npm run deploy --workspace=packages/backend` |
| Monitor | Cloudflare Workers | `npm run deploy --workspace=packages/monitor` |

---

## 🔒 Security

- **Zero-knowledge encryption**: User data is encrypted with a per-user Data Encryption Key (DEK) using **AES-256-GCM** before writing to R2.
- **Key wrapping**: The DEK is wrapped with both the user's password and a server-side recovery key, so the server never stores plaintext data.
- **JWT authentication**: All data routes are protected; tokens are validated on every request via middleware.
- **Password reset**: Codes are sent exclusively through a linked Telegram account — no email required.

---

## 📄 License

This project is for personal/portfolio use. Feel free to explore the code for learning purposes.

---

<p align="center">
  Made with ☕ and 🐱 by <strong>Renan Buiatti</strong>
</p>
