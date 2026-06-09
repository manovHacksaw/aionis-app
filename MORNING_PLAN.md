# Aionis — Final Hackathon Morning Push
**Deadline:** June 10, 2026 · Budget: ~3.5 hours

---

## Already done tonight (pre-sleep)
- [x] Remove yellow `hover:border-accent/30` glow from all cards globally
- [x] Agents page — strip Manage/Pause/Resume buttons; card click → manage
- [x] Dashboard Transaction History — filter out SKIPPED trades
- [x] Trades page — add "Executed" filter (OPEN+CLOSED), set as default landing filter
- [x] Watcher heartbeat → "Monitor · Xs ago" on manage page
- [x] Deploy page reframed as "Deploy AI Agent" with dynamic preview panel

---

## Morning blocks (priority order)

---

### Block 1 — Global "Agent Network: Live" navbar pill (10 min)
**Impact: High — judges see it on every single page, instant credibility.**

Read `/api/watcher/status` from `AppNavbar`. Show a green pulsing dot + "Live" when online, red "Offline" if key expired.

**File:** `frontend/components/AppNavbar.tsx`
- Add a `useEffect` that fetches `/api/watcher/status` once on mount (no polling needed in nav)
- Render: `<div className="flex items-center gap-1.5 text-[11px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/><span>Live</span></div>`
- Place it in the nav bar between the nav links and the connect button

---

### Block 2 — Vault address surfaced as "Your Agent Contract" (5 min)
**Impact: High — makes the agent feel like a real on-chain primitive to judges.**

On the manage page, compute and display the deterministic vault address.

**File:** `frontend/app/(app)/traders/[address]/manage/page.tsx`
- Import `keccak256, encodePacked` from viem (already imported elsewhere)
- Compute: `const vaultId = address ? keccak256(encodePacked(['address','address'], [address, leaderAddress])) : null`
- Add a small row below the leader stats card: `Your Agent Contract · <monospace>{vaultId.slice(0,10)}…{vaultId.slice(-6)}</monospace> · [↗ explorer link]`
- This proves the agent is a real on-chain entity with a verifiable address

---

### Block 3 — Token logos & visual polish (25 min)
Remove ALL placeholder initials (W, U, N etc.) — swap for real token logos everywhere.

**Files to touch:**
- `frontend/public/token-logos/` — add `aUSD.svg`: SVG circle with dark background (#0f172a), white "aUSD" text at 10px bold. Save as both SVG and reference in TokenLogo component.
- Search for `symbol.slice(0, 2)` fallbacks across all TSX files and replace with a generic coin SVG fallback instead of initials
- Check `frontend/app/(app)/traders/page.tsx` leader rows — any avatar/token cell using initials

**aUSD logo minimal SVG:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="16" fill="#10b981"/>
  <text x="16" y="20" font-family="sans-serif" font-size="9" font-weight="700"
        fill="white" text-anchor="middle">aUSD</text>
</svg>
```

---

### Block 4 — /demo route (20 min)
**Impact: High — judges can see a live running agent WITHOUT connecting a wallet.**

**New file: `frontend/app/(app)/demo/page.tsx`**
- Hardcode a known follower wallet address that has real trades in the DB (check `positions` table for an active wallet)
- Render a read-only version of the manage page for that wallet: activity logs, vault stats, recent trades
- Banner at top: `"This is a live Aionis agent running on Somnia Testnet. No wallet required to view."`
- Link from homepage hero CTA: "Watch a Live Agent →"

---

### Block 5 — Dashboard page (40 min)

#### 5a. Kill mock charts
`MainChart` and `RateChart` use hardcoded data arrays — they lie to judges. Replace:
- **Remove** "Total Copy Volume ($59M)" and "Copy Rate (6.19%)" cards entirely
- **Replace with** two real cards:
  1. **Agent Pipeline card**: 4-step horizontal flow diagram — `Detect swap → Score with AI → Execute via Keeper → Monitor P&L` — with a one-line description of each step. Static, but explains the autonomous loop visually.
  2. **Platform Activity card**: uses real `/api/stats` data — positions opened today (add `openedToday` count to the stats API), active agents, watcher last heartbeat age

#### 5b. Non-wallet-connected state
- Portfolio chart card: if `!isConnected`, replace the chart with `"Connect wallet to see your live portfolio"` + ConnectButton, not a `$10,000.00` mock value
- Remove the `"10,000.00"` string fallback on line ~555

#### 5c. Dashboard subtitle / framing
Current page reads like a generic DeFi dashboard. Add a subtitle under the hero: `"Your autonomous trading agents are running on Somnia right now."` (or `"No agents deployed yet — pick a leader below to get started."` if agents.length === 0)

---

### Block 6 — Traders page: AI-generated leader inference (40 min)
**Impact: Very high for "Innovation" criterion — Claude generating real on-chain analysis.**

**New file: `frontend/app/api/traders/[address]/inference/route.ts`**
```
GET /api/traders/[address]/inference
```
- Query `leader_swaps` for this address (last 100 rows): timestamps, token_in, token_out, usd_value
- Compute client-side before sending to Claude:
  - Most active hour of day (UTC)
  - Most traded token pair
  - Avg trade size (USD)
  - Buy/sell ratio
  - Activity trend: compare last 30 vs previous 30 swaps (growing/declining)
  - Win rate from `positions` table (already exists)
- Prompt Claude Haiku with these stats → 2-3 sentence NL summary
- Redis cache: `aionis:inference:{address}` with 1h TTL

**UI change: `frontend/app/(app)/traders/[address]/page.tsx`**
- Fetch `/api/traders/${address}/inference` in a separate `useEffect`
- Show below the stats grid: shimmer while loading, then the paragraph
- Add `"AI Analysis · Generated by Claude Haiku"` label with a small sparkle icon

---

### Block 7 — Backtesting preview on deploy page (30 min)
**Impact: Very high for credibility — shows the agent would have worked.**

**New file: `frontend/app/api/traders/[address]/backtest/route.ts`**
```
GET /api/traders/[address]/backtest?tokens=0x...&riskLevel=3&minLeaderUsd=0&maxLeaderUsd=0
```
- Pull last 7 days of `leader_swaps` for this leader
- Simulate which swaps would have passed the token filter + min/max leader trade size
- For each passing swap, look up if a corresponding `position` was opened (JOIN on leader+token+approx timestamp)
- Return: `{ tradesEvaluated, tradesExecuted, winRate, estimatedPnlPct }`

**UI: `frontend/app/(app)/traders/[address]/deploy/page.tsx`**
- Fetch on mount (and re-fetch when `selectedTokens` or `riskLevel` changes, debounced 500ms)
- Show above the submit button: `"Based on the past 7 days: X trades evaluated, Y executed, Z% win rate"`
- If no data: `"Not enough history to simulate"` — graceful

---

### Block 8 — Shareable public agent page (25 min)
**Impact: High — judges can be sent a direct link to a running agent.**

**New file: `frontend/app/(app)/portfolio/[address]/page.tsx`**
- Read-only view of a follower's agent portfolio
- Shows: total agents, combined P&L, individual agent cards (read-only, no deposit/withdraw)
- No wallet connection required
- Banner: `"Viewing public agent portfolio for {address}"`
- Add "Share" button on the portfolio page that copies `window.location.origin/portfolio/${address}` to clipboard

---

### Block 9 — Portfolio page refactor (25 min)

Current state: shows agents, summary stats, activity feed.

**Add:**
1. **Total balance card** at top: `totalLocked + totalPnl + freeBalance(aUSD wallet)` with a small line chart (reuse `PortfolioChart` SVG component, already in `page.tsx`)
2. **Token breakdown** below balance: list of tokens held across open positions with allocated amount + P&L per token
3. **Previously held** section: closed positions grouped by token, showing total realized P&L per token

**API extension:** Add to `/api/vaults/${address}` response:
```json
{
  "tokenBreakdown": [
    { "token": "WSOMI", "allocated": 500, "unrealizedPnl": 12.5, "openCount": 3 },
    { "token": "USDC",  "allocated": 200, "unrealizedPnl": -1.2, "openCount": 1 }
  ],
  "closedByToken": [
    { "token": "WSOMI", "realizedPnl": 34.0, "tradeCount": 7 }
  ]
}
```
Compute these with two `groupBy` Prisma queries in the existing `/api/vaults/[address]/route.ts`.

---

### Block 10 — Faucet page expansion (15 min)

Replace the narrow centered card with a full-width two-column layout:

**Left column (60%):**
- "What is aUSD?" — 2-3 sentences
- "Testnet vs Mainnet" comparison table:

| | Testnet (now) | Mainnet (coming) |
|---|---|---|
| Chain | Somnia Shannon · 50312 | Somnia · 5031 |
| Token | aUSD (test) | USDC / real assets |
| Agents | Demo agents, simulated P&L | Live copy-trading |
| Gas | STT (free faucet) | STT |

**Right column (40%):**
- Existing claim card
- STT faucet link below it

---

### Block 11 — "Watching" banner on leader profile (10 min)
Close the loop between discover and manage. When a logged-in user visits `/traders/[address]` and they already have an agent following that leader, show a green banner at the top:

**File:** `frontend/app/(app)/traders/[address]/page.tsx`
- Fetch user's vaults from `/api/vaults/${userAddress}` (or check if `vaultStats` is non-null — already fetched with `?follower=` param)
- If `vaultStats` exists (agent is running): render `"Your agent is actively watching this leader · Manage →"` in a green banner above the stats grid

---

### Block 12 — Traders / Discover page CTA (10 min)

**File:** `frontend/app/(app)/traders/page.tsx`
- Add subtitle under the "Traders" header: `"Browse on-chain leaders from Somnia Mainnet. Click any row to view their profile — then deploy an agent to copy their trades automatically."`
- When `!isConnected`: add a soft note under the table: `"Connect wallet to deploy an agent for any leader"`

---

### Block 13 — Agent throughput stats (20 min)
**Impact: Direct answer to "Autonomous Performance" — judges see the system is actually doing work.**

**Watcher change (`watcher/src/copy-engine.ts` or wherever AI scoring happens):**
- On each `explainTrade` call: `redis.incr('aionis:stats:aiCalls:today')` with a midnight TTL
- On each `callClosePosition` / `callOpenPosition`: `redis.incr('aionis:stats:executions:today')`
- On each swap event evaluated: `redis.incr('aionis:stats:evaluated:today')`

**API change (`frontend/app/api/stats/route.ts`):**
- Read the three Redis counters alongside existing stats
- Return: `{ ..., aiCallsToday, executionsToday, tradesEvaluatedToday }`

**UI:** Add to homepage hero stats: `"AI Decisions Today: 47"` or similar.

---

### Block 14 — README.md (15 min)

**File: `README.md` in repo root**

Sections:
1. **What is Aionis?** — 3 sentences (agent-first copy-trading on Somnia)
2. **Architecture diagram** (ASCII):
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
3. **Stack:** Next.js 15, Prisma (PostgreSQL), Upstash Redis, Claude Haiku, viem, Privy auth, Somnia testnet
4. **Live deployment:** [app link] · [landing page link]
5. **Local dev setup:** env vars list, `npm install`, `npm run dev`
6. **Judging criteria alignment** — 1 bullet per criterion

---

### Block 15 — Landing page (separate project) (30 min)

Create a new Next.js project at `/Desktop/code/projects/aionis-landing/`.

**Approach:** `npx create-next-app@latest aionis-landing --tailwind --app` then edit index page.

**Required sections:**
1. **Hero** — `"AI Agents That Trade For You"` · `"Deploy in 30 seconds on Somnia's Agentic L1"` · CTAs: [Launch App →] [Watch Demo]
2. **Live stats bar** — fetch from `{APP_URL}/api/stats`: Active Agents · aUSD Under Management · Positions Opened
3. **How it works** — 3 steps with icons: Browse Leaders → Configure Agent → Earn Autonomously
4. **Feature highlights** — 4 cards: AI Trade Scoring · Autonomous Stop-Loss · Keeper Delegation · Real-Time Monitoring
5. **Footer** — GitHub link · Demo video · App link

**Deploy:** Separate Vercel project. The [Launch App] button links to the main app URL.

---

## Stretch / if time allows

- [ ] Execution latency on positions — store `latencyMs` when PositionOpened fires vs leader trade timestamp; show "Avg execution lag: 8s" on manage page
- [ ] Portfolio sparkline per agent card
- [ ] Trades page: sortable columns (click header)
- [ ] Leader profile: 24h activity heatmap (24 cells, colored by trade count per hour)
- [ ] OG image API: `/api/og?address=...` for social share previews of leader profiles
- [ ] "Last leader activity" timestamp on agent cards in the agents list

---

## Time budget summary

| Block | Item | Time |
|-------|------|------|
| 1 | Navbar "Agent Network: Live" pill | 10m |
| 2 | Vault address on manage page | 5m |
| 3 | Token logos + aUSD.svg | 25m |
| 4 | /demo route (real wallet, no login) | 20m |
| 5 | Dashboard mock charts → real | 40m |
| 6 | AI leader inference endpoint + UI | 40m |
| 7 | Backtesting preview on deploy | 30m |
| 8 | Shareable public agent page | 25m |
| 9 | Portfolio total balance + token breakdown | 25m |
| 10 | Faucet full-page expansion | 15m |
| 11 | "Watching" banner on leader profile | 10m |
| 12 | Traders page discover CTA | 10m |
| 13 | Agent throughput stats (watcher + API + UI) | 20m |
| 14 | README.md | 15m |
| 15 | Landing page (separate project) | 30m |
| **Total** | | **~5.5h** |

**If only 3.5 hours:** do blocks 1–9 + 14. Skip 10–13 and 15 (landing page can be done after submission if allowed).

**Absolute minimum viable (2 hours):** blocks 1, 2, 3, 4, 5, 6, 14. These cover every judging criterion visually.

---

## Submission checklist

- [ ] GitHub repo public: `manovHacksaw/aionis-app`
- [ ] Live app deployed on Vercel
- [ ] Watcher running on Render (keep-alive cron active)
- [ ] Demo video (2-5 min) recorded and uploaded
- [ ] README.md with architecture + judging alignment
- [ ] Landing page live (separate deployment)
- [ ] Presentation deck (5-7 slides, one per judging criterion)

---

## Demo video script (2–3 min)

1. Open landing page → "AI Agents That Trade For You" → click Launch App
2. Homepage: show live platform stats (Active Agents, aUSD, Positions) — real numbers
3. Navbar: green "● Live" dot visible → "the agent network is running right now"
4. Go to Traders → click a leader → AI inference paragraph loads → "Claude analyzed this trader's on-chain history"
5. Click "Deploy Agent" → show the dynamic preview panel updating as risk level changes → show backtesting result
6. Go to Manage page → show "Monitor · 3s ago" heartbeat → "the watcher checked 3 seconds ago"
7. Go to Trades → filter "Executed" → show a closed trade with Stop-Loss badge → "the agent closed this autonomously"
8. Close: "Every step — discover, deploy, execute, protect — runs without user input. That's Aionis on Somnia's Agentic L1."

---

## Judging criteria alignment

| Criterion | Evidence |
|-----------|----------|
| **Functionality** | Deployed on Vercel + Render · watcher heartbeat visible live · on-chain positions verifiable on Somnia explorer · stop-loss closes confirmed |
| **Agent-First Design** | Deterministic agent vault addresses · keeper delegation pattern · agents discover/invoke/monitor autonomously · watcher heartbeat in UI |
| **Innovation** | Per-vault stop-loss with in-process registry · AI-scored copy decisions with NL explanations · backtesting preview · throughput stats · execution latency tracking |
| **Autonomous Performance** | 15s poll cycle · Redis heartbeat with age indicator · stop-loss fires without user action · email notifications on position open · auto-refresh on all pages |
