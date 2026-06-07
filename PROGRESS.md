# Aionis — Session Progress & Open Issues

## Deployed Contracts (Somnia Shannon Testnet, chain 50312)

| Contract | Address |
|----------|---------|
| VaultManager (current) | `0x3672E7703B6A446d2c38878A227ca2f32Fa5d408` |
| aUSD | `0xaE2DE61038F8086293134e33615C7761933F81E4` |
| Keeper wallet | `0x842056bb847BCe24bEb6D0d08703024DBa94CCE9` |
| Deployer wallet | `0x7DcF628f79676ec5755Da9EF1fb312460E1599E4` |
| Somnia Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |

**Previous (dead) VaultManagers:**
- `0x070f3A3BceAB706dD1cFB64cF14854c14e109e0F` — first deploy
- `0x93fF8B81111BaBc5001a9cC6385895f1AE5A2E74` — second deploy (stuck pipeline)
- `0x24108C322FeDD9e86B447Bb74f641483454d25ab` — third deploy (localhost API_BASE bug)
- `0x5f0EA2dd5BE70F22375D42034d543C3f91B49667` — fourth deploy (vault got CLOSED via `withdraw()`, vaultId has no nonce so the (follower,leader) pair was permanently dead — see "Resolved This Morning")

---

## Agent IDs (Somnia Agent Platform)

| Agent | ID |
|-------|----|
| JSON API Agent | `13174292974160097713` |
| LLM Agent | `12847293847561029384` |

---

## Infrastructure

- **ngrok**: `https://garnish-hardcopy-annotate.ngrok-free.dev` → `http://localhost:3001`
- **API_BASE on contract**: `https://garnish-hardcopy-annotate.ngrok-free.dev/api/agent/leader/`
- **PRICE_API_BASE on contract**: `https://garnish-hardcopy-annotate.ngrok-free.dev/api/price/`
- **Frontend (UI)**: `localhost:3000` — runs from `frontend/` directory (Privy is configured
  for this origin only — its CSP is `frame-ancestors 'self' http://localhost:3000 ...`,
  so auth 403s with "Origin not allowed" if frontend lands on any other port)
- **Root app (API routes)**: `localhost:3001` — runs from project root `src/`. Frontend's
  `next.config.ts` has a hardcoded rewrite `'/api/:path*' → 'http://localhost:3001/api/:path*'`
  that proxies all `/api/*` calls there.
- **Watcher**: `watcher/src/index.ts`

> **Critical #1**: Next.js 16 in `frontend/` detects monorepo root at `/somnia/` and reads
> env from **root `.env.local`**, NOT `frontend/.env.local`. Always update the root file.
>
> **Critical #2 — START FRONTEND FIRST**: port assignment is a race for `:3000`. Frontend
> MUST win it (Privy + the `next.config.ts` rewrite both hardcode this convention). Always:
> 1. `cd frontend && npm run dev` (claims `:3000`)
> 2. *then* `cd <root> && npm run dev` (falls back to `:3001`)
> 3. point ngrok at `:3001`
> If you ever see Privy throw "Origin not allowed" / 403, or `/api/traders/...` 500 in a
> loop, the ports are flipped — kill both and restart in the order above. Sanity check:
> `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/agent/leader/<addr>/latest-swap`
> should return `200` directly from the root app (not proxied).

---

## Fixes Applied This Session

### VaultManager.sol
- Fixed `ISomniaAgentPlatform` interface: return type `bytes32` → `uint256`, added `getRequestDeposit()`
- Fixed agent IDs: was hardcoded `1` and `2` → correct IDs `13174292974160097713` / `12847293847561029384`
- Fixed `pipelineActive bool` permanent lock → `pipelineActiveAt uint256` with 10-min auto-expiry
- Fixed `mapping(bytes32 => ...)` for requestId lookups → `mapping(uint256 => ...)`
- Added dynamic fee: `getRequestDeposit() + 0.09 ether` for JSON API, `+ 0.21 ether` for LLM
- LLM callback (`onWatcherResponse`) now sends `{value: llmFee}` from contract balance
- Added `owner`, `setApiBase`, `setPriceApiBase`, `transferOwnership`
- All callback params changed: `bytes32 requestId` → `uint256 requestId`

### Watcher (`watcher/src/keeper.ts`)
- `AGENT_FEE`: `0.001 ETH` → `0.4 ETH`
- Added receipt status check — throws if tx reverted

### Price feed (`watcher/src/price.ts`)
- `globalState()` ABI: removed 2 extra outputs (pool returns 192 bytes = 6 × 32, not 8)

### Env files
- Root `.env.local`: `NEXT_PUBLIC_VAULT_MANAGER_ADDRESS` → `0x5f0EA2dd5BE70F22375D42034d543C3f91B49667`
- `frontend/.env.local`: same update (redundant but kept in sync)
- `watcher/.env`: `VAULT_MANAGER_ADDRESS` → `0x5f0EA2dd5BE70F22375D42034d543C3f91B49667`

### Scripts
- `contracts/web3/scripts/setApiBase.ts` — updates API_BASE + PRICE_API_BASE on deployed contract
  - Usage: `NGROK_URL=https://xxx.ngrok-free.dev npx hardhat run scripts/setApiBase.ts --network somnia`

---

## Root Cause History (why it kept failing)

1. **Wrong agent IDs** → `createRequest` always reverted
2. **Wrong return type** (`bytes32` vs `uint256`) → ABI mismatch
3. **Insufficient STT fee** (0.001 → 0.4 STT needed)
4. **`pipelineActive = true` forever** → second call always reverted "pipeline already running"
5. **`API_BASE = http://localhost:3001`** → agent platform validators can't reach localhost; ngrok URL needed
6. **Root `.env.local` had old VaultManager** (`0xaECd020C04...`) → frontend read wrong contract

---

## Resolved This Morning (2026-06-07)

### "VM: vault not active" — root cause + permanent fix

**The real cause** (not what we guessed last night): the vault for
`(follower=0xfd3495..., leader=0xc3ef32...)` was not PAUSED — it was **CLOSED**
(`status = 2`, `ausdLocked = 0`). Someone had called `withdraw()` on it (likely during
one of the "delete the vault" cleanup attempts), which permanently sets `status = CLOSED`
and zeroes the balance. The DB's `UserVault` row was never updated to match, so it kept
showing `status: ACTIVE, ausdcLocked: 200` — a stale record that doesn't reflect chain state.

**The structural landmine**: `vaultId = keccak256(follower, leader)` has **no nonce**
(`VaultManager.sol:270-272`), and `createVault` requires `vaults[id].follower == address(0)`
("VM: vault already exists", line 301). Once a vault for a given (follower, leader) pair is
closed, **that exact pair can never call `createVault` again on that contract** — permanent
dead-end. This is what made last night's vault unrecoverable.

**Fix applied**: added a `reopenVault(leader, amount, riskLevel, maxPerTradePct, allowlist)`
function + `VaultReopened` event to `VaultManager.sol` (right after `withdraw`). It requires
`status == CLOSED` and `follower == msg.sender`, takes a fresh deposit, and resets the
`VaultConfig` in place — giving a path back to ACTIVE without redeploying every time a vault
is closed. Compiled clean (`npx hardhat compile`).

**Redeployed** to `0x3672E7703B6A446d2c38878A227ca2f32Fa5d408` (5th deploy — needed anyway
since the old contract's dead vault record couldn't be reset without the new function).
Ran `setApiBase.ts` → same ngrok URL. Updated all 3 env files. Wiped the stale `UserVault`
+ `Position` rows from the DB (`deleteMany({})`).

**Bonus catch (and its correction)**: first restart attempt let the root app win `:3000`
(frontend got `:3001`). That looked plausible — both serve `200` thanks to frontend's
`next.config.ts` rewrite — but it silently broke two things: (1) Privy's CSP only allows
`frame-ancestors http://localhost:3000`, so auth threw 403 "Origin not allowed" with
frontend on `:3001`, and (2) the rewrite hardcodes `destination: 'http://localhost:3001/api/:path*'`,
so with frontend ALSO on `:3001` it proxied `/api/*` back to itself → infinite loop → 500s
on `/api/traders/leaderboard`. **Correct convention is frontend=`:3000`, root=`:3001`**
(restored — see Infrastructure section above). Killed both, restarted frontend first,
confirmed via `lsof` (frontend PID on `:3000`, root `somnia@0.1.0` PID on `:3001`),
repointed ngrok back to `:3001`, re-verified tunnel → `200`.

**Keeper balance checked**: `0x842056...` now has `2.19 STT` — comfortably above the
`0.4 STT` needed per `checkLeaderActivity` call (got refunded/topped up since last night's `0.19`).

### Next action
Open the frontend at **`localhost:3000`** and create a fresh vault for
`(0xfd3495..., 0xc3ef32...)` — the new contract has no record for this pair
(`follower == address(0)` passes), so plain `createVault` works normally. `reopenVault`
is now there as a safety net if this one ever gets closed too.

---

## How to Resume

```bash
# 1. Start frontend FIRST so it claims :3000 (Privy + next.config.ts rewrite require this)
cd /Users/manobendramandal/Desktop/code/projects/somnia/frontend && npm run dev &
sleep 6
# 2. Then root app — it'll fall back to :3001
cd /Users/manobendramandal/Desktop/code/projects/somnia && npm run dev &

# 3. Start watcher
cd /Users/manobendramandal/Desktop/code/projects/somnia/watcher && npm run dev &

# 4. Sanity check the convention held (root API directly on :3001, not proxied):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/agent/leader/0xc3ef32972c265a82efef46097dff1289cbdee72e/latest-swap
# 200 = correct. If you get errors/loops, ports flipped — kill all `next dev`/`tsx watch`
# and redo step 1-2 in order.

# 5. ngrok must point at :3001:
ngrok http 3001
curl -s -o /dev/null -w "%{http_code}\n" https://garnish-hardcopy-annotate.ngrok-free.dev/api/agent/leader/0xc3ef32972c265a82efef46097dff1289cbdee72e/latest-swap
# If the ngrok URL changed, re-run:
# NGROK_URL=https://xxx.ngrok-free.dev npx hardhat run scripts/setApiBase.ts --network somnia
# (VAULT_MANAGER in setApiBase.ts is currently 0x3672E7703B6A446d2c38878A227ca2f32Fa5d408)

# 6. Open http://localhost:3000 — create a fresh vault for the leader you want to
#    follow, set keeper, fund it, swap.
```

---

## Next Phase — Planned Enhancements (12-point spec, pasted by user 2026-06-07)

Implementation plan for the next round of Aionis work. Not yet started — saved here
verbatim so it survives a context reset.

### 1. Partial aUSD Withdrawals
Currently withdrawing is all-or-nothing and closes the vault.
- Users can withdraw any partial amount of free (unallocated) aUSD at any time.
- Capital protection: cannot withdraw funds active in open virtual positions
  (e.g. $100 locked, $30 in a trade → max withdrawal is $70).
- If the entire free balance is withdrawn and there are no active trades, the vault
  auto-closes; otherwise it stays active with the remaining capital.

### 2. Rebranding: "Vaults" → "Agents"
- Replace "Vault" with "Agent" everywhere in the UI: menus, buttons, notifications.
- Users "deploy an Agent" to follow a leader and configure "Agent settings".

### 3. Dynamic Visual Avatars for Leaders & Followers
- Every wallet address (leader or follower) maps to a unique generated gradient +
  geometric symbol (deterministic from the address).
- Premium look: glassmorphism, electric blues/neon purples/sunset-orange gradients —
  so top leaders are instantly recognizable by their icon.

### 4. Portfolio: Live Token Holdings
- Replace the vault-list Portfolio view with a consolidated **Token Holdings** dashboard
  showing what tokens the user's agents virtually hold (WSOMI, NIA, USDC, ...).
- When multiple agents hold the same token, aggregate: total capital value, weighted
  average entry price, current market price, combined unrealized P&L ($ and %), and a
  breakdown of which agents hold it.

### 5. Dedicated "Agents" Dashboard
- New page `/agents` — the control room for copy-trading containers (now that Portfolio
  focuses on token holdings).
- Shows: total locked capital across all agents, count of active agents, a card list of
  deployed agents, and quick Pause/Resume/Manage controls per card.

### 6. Rebranding: Traders directory → "Discover"
- Rename "Traders" to "Discover" in nav header and page headings — the portal for
  browsing/discovering leader wallets to follow.

### 7. Privy Wallet Integration & Local Transaction Execution
- Clarify Privy's two wallet types: External (MetaMask/Rabby/Coinbase — Privy is just a
  connector, signing happens in the extension) vs. Embedded (Google/Email login — MPC
  wallet, signing happens in a Privy-controlled iframe popup).
- Add this explanation to onboarding so users understand why MetaMask still pops up
  when they "logged in via Privy".

### 8. First-Time User Onboarding Flow
Step-by-step wizard on first login:
1. Welcome & Privy wallet info (address + copy button, "this is where your testnet funds live")
2. aUSD & Testnet vs. Mainnet — Somnia Shannon Testnet, aUSD = simulated stablecoin,
   STT = gas token; trades are virtual/on-chain, capital locked as aUSD, nothing real
   bought/sold (no slippage risk to the user)
3. Setup Notifications — collect email, opt in to real-time trade-copy/close alerts via Resend
4. Funding & Getting Started — claim 10,000 aUSD from the faucet, deploy first agent

### 9. Advanced Agent Configuration
Replace the simple risk slider with granular controls:
- **Risk levels**:
  - L1 Very Conservative — copy score 80+, max 5% size, 0.5% slippage tolerance
  - L2 Conservative — copy score 60+, max 10% size, 1.0% slippage tolerance
  - L3 Moderate — copy score 40+, max 20% size, 2.0% slippage tolerance
  - L4 Aggressive — copy score 20+, max 35% size, 3.0% slippage tolerance
  - L5 Hyper-Aggressive — copy score 10+, max 50% size, 5.0% slippage tolerance
- **Slippage tolerance** — max allowed price move between leader execution and agent entry
- **Trade size limits**:
  1. Min leader trade size (USD) — ignore leader trades smaller than this (filters dust)
  2. Max leader trade size (USD) — ignore leader trades larger than this (filters outliers)
  3. Min allocation from vault (aUSD) — skip if computed copy size is below this
  4. Max allocation from vault (aUSD) — hard cap on copy capital per trade regardless of score

### 10. Natural Language AI Trade Reasoning
Replace the raw numeric score (e.g. "78/100") in trade history with a natural-language
explanation of why a trade was copied or skipped, e.g.:
- Copied: *"The agent copy-traded $45.00 aUSD of WSOMI (score 85/100). The trade was
  strongly approved because the leader committed a substantial portion (25%) of their
  portfolio to this entry, aligning with your moderate risk settings."*
- Copied (smaller): *"Copied with a conservative allocation of $10.00 aUSD (score 35/100).
  The signal was weaker due to low leader trade volume, and your Low Risk profile
  prioritized capital preservation."*
- Skipped (slippage): *"Trade skipped: Slippage limit exceeded. The token price rose 2.4%
  above the leader's entry, which is beyond your 1% slippage threshold."*
- Skipped (allowlist): *"Trade skipped: Token not in allowlist. The leader bought NIA,
  which is currently deselected in your agent's settings."*
- Skipped (balance): *"Trade skipped: Insufficient balance. The calculated minimum
  allocation was $15.00, but your agent only has $4.20 in free capital."*

### 11. Manual "Stop" for Ongoing Trades
- Let users manually close ("Stop") an active virtual position at any time, instead of
  waiting for the leader to sell.
- Instant settle: closing immediately exits the position on-chain, fetches the current
  token price, computes P&L, updates the agent's aUSD balance, and unlocks the capital.

### 12. Workspace Cleanup
- Delete legacy folders: `prisma_old`, `src_old`.
- Delete obsolete root configs left over from when the frontend lived at the repo root:
  `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`,
  `tsconfig.tsbuildinfo`.

### Verification & Deployment Plan
1. Compile the contract to verify code changes are valid.
2. Deploy the updated `VaultManager` to Somnia Shannon Testnet.
3. Generate and run Prisma migrations for new tables/config columns.
4. Local smoke tests:
   - Complete the onboarding wizard as a fresh user
   - Customize and save advanced agent configuration settings
   - Verify partial withdrawals update free balance and over-withdraw attempts are blocked
   - Trigger mock trades and verify the portfolio token-holdings table aggregates correctly
   - Manually stop an ongoing trade and verify instant on-chain settlement
   - Check that trade history shows natural-language reason logs

