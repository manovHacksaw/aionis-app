# Aionis — AI-Powered Copy-Trading Protocol on Somnia

Aionis is the first agent-first copy-trading protocol built natively on Somnia. It empowers users to deploy autonomous, AI-driven copy-trading agents that monitor leader activity on Somnia Mainnet and execute mirrored trades on the high-performance Somnia Testnet. By combining high-speed execution, non-custodial smart contract vaults, and AI-powered trade scoring, Aionis makes institutional-grade automated trading accessible to everyone.

## Architecture

```
Somnia Mainnet ──swap events──► Watcher Service ──score──► Claude Haiku (AI)
                                      │                          │
                                      └──────── decision ────────┘
                                                 │
                                           Keeper Agent
                                                 │
                                      VaultManager.sol (on-chain)
                                                 │
                                         User's Agent Vault
                                      (deterministic address per follower+leader)
```

## Technology Stack

- **Frontend:** Next.js 16 (App Router), TailwindCSS, Wagmi, Viem, Privy Auth
- **Backend / Watcher:** Node.js (TypeScript), Viem
- **Database:** Prisma ORM, PostgreSQL (Supabase)
- **Caching & Stats:** Upstash Redis
- **AI Engine:** Claude Haiku (with fallback LLM reasoning)
- **On-Chain Ecosystem:** Somnia Shannon Testnet (Chain ID `50312`), customized `aUSD` stablecoin, smart contract-based agent vaults

## Live Deployment

- **Live Application:** [aionis-app.vercel.app](https://aionis-app.vercel.app)
- **Landing Page:** [aionis-landing.vercel.app](https://aionis-landing.vercel.app)

---

## Local Development Setup

To run Aionis locally, configure the environment variables and boot up the frontend and watcher services.

### 1. Environment Variables Configuration

#### Frontend (`frontend/.env.local`)
Create a `frontend/.env.local` file with the following variables:
```env
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID_HERE

# Supabase Postgres URLs
DATABASE_URL="postgresql://username:password@host:port/database?pgbouncer=true"
DIRECT_URL="postgresql://username:password@host:port/database"

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# Somnia RPC URLs
NEXT_PUBLIC_SOMNIA_MAINNET_RPC=https://api.infra.mainnet.somnia.network/
NEXT_PUBLIC_SOMNIA_TESTNET_RPC=https://dream-rpc.somnia.network

# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# On-Chain Contract Addresses (Somnia Shannon Testnet)
NEXT_PUBLIC_FOLLOWER_REGISTRY_ADDRESS=0x070A3aDB8d7fAe01C6bf3d5C7b49a073D50bb6e2
NEXT_PUBLIC_AUSDC_ADDRESS=0xaE2DE61038F8086293134e33615C7761933F81E4
NEXT_PUBLIC_VAULT_MANAGER_ADDRESS=0x3C5e0BC3d2F7338704938CecAb02BBa6BAc6da6B
NEXT_PUBLIC_WSOMI_USDC_POOL=0xe5467Be8B8Db6B074904134E8C1a581F5565E2c3

# Notifications & AI Keys (Optional / Fallbacks)
RESEND_API_KEY="your_resend_api_key"
OPENAI_API_KEY="your_openai_api_key"
```

#### Watcher (`watcher/.env`)
Create a `watcher/.env` file with the following variables:
```env
# Database URLs
DATABASE_URL="postgresql://username:password@host:port/database?pgbouncer=true"
DIRECT_URL="postgresql://username:password@host:port/database"

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# Contracts (Somnia Shannon Testnet)
FOLLOWER_REGISTRY_ADDRESS=0x070A3aDB8d7fAe01C6bf3d5C7b49a073D50bb6e2
VAULT_MANAGER_ADDRESS=0x3C5e0BC3d2F7338704938CecAb02BBa6BAc6da6B
AUSDC_ADDRESS=0xaE2DE61038F8086293134e33615C7761933F81E4

# Keeper Wallet (triggers copy trades on-chain)
KEEPER_PRIVATE_KEY=your_keeper_private_key

# Copy-trade settings
DEFAULT_COPY_PCT=20
```

### 2. Booting Services

Install dependencies and start development servers:

#### Start Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Start Watcher
```bash
cd watcher
npm install
npm run dev
```

---

## Judging Criteria Alignment

- **Functionality:** Fully operational system deployed live across Vercel & Render, featuring real-time watcher heartbeats, on-chain execution verifiable on the Somnia Testnet explorer, automated stop-loss guardrails, and direct email alerts.
- **Agent-First Design:** Implements deterministic smart contract vaults per follower-leader pair, non-custodial keeper delegation patterns, and fully automated monitoring loops that update and execute without user intervention.
- **Innovation:** Features advanced per-vault stop-loss mechanics with in-process registries, Claude Haiku AI trade-scoring with natural language reasoning explanations, dynamic backtesting previews on deployment, and throughput statistic tracking.
- **Autonomous Performance:** Operates on a rapid 15s poll cycle with Redis heartbeat indicators, executing automated trade protection (stop-losses) and copy-trading triggers autonomously while broadcasting real-time logs to user pages.
