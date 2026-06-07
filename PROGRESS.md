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

- **ngrok**: `https://garnish-hardcopy-annotate.ngrok-free.dev` → `http://localhost:3000`
- **API_BASE on contract**: `https://garnish-hardcopy-annotate.ngrok-free.dev/api/agent/leader/`
- **PRICE_API_BASE on contract**: `https://garnish-hardcopy-annotate.ngrok-free.dev/api/price/`
- **Root app (API routes)**: `localhost:3000` — runs from project root `src/` (whichever of root/frontend starts FIRST grabs 3000 — check with `lsof -nP -iTCP -sTCP:LISTEN | grep 300`)
- **Frontend (UI)**: `localhost:3001` — runs from `frontend/` directory
- **Watcher**: `watcher/src/index.ts`

> **Critical #1**: Next.js 16 in `frontend/` detects monorepo root at `/somnia/` and reads
> env from **root `.env.local`**, NOT `frontend/.env.local`. Always update the root file.
>
> **Critical #2**: Port assignment is a RACE — whichever of the root app / frontend starts
> first grabs `:3000`, the other gets `:3001`. ngrok must point at whichever one is
> serving `/api/agent/leader/...` (the root app with `src/app/api/`). Verify with:
> `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/agent/leader/<addr>/latest-swap`
> (200 = API routes are here) before pointing/repointing ngrok.

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

**Bonus catch**: this time the root app raced frontend for port 3000 and won — root landed
on `:3000`, frontend on `:3001` (reversed from before). ngrok was still pointed at `:3001`
(now frontend, no API routes → would have silently broken the pipeline again). Repointed
ngrok to `:3000` and verified end-to-end: `curl https://garnish-hardcopy-annotate.ngrok-free.dev/api/agent/leader/.../latest-swap` → `200`.

**Keeper balance checked**: `0x842056...` now has `2.19 STT` — comfortably above the
`0.4 STT` needed per `checkLeaderActivity` call (got refunded/topped up since last night's `0.19`).

### Next action
Create a fresh vault for `(0xfd3495..., 0xc3ef32...)` through the frontend UI — the new
contract has no record for this pair (`follower == address(0)` passes), so plain
`createVault` works normally. `reopenVault` is now there as a safety net if this one ever
gets closed too. **Remember the frontend UI is now on `:3001`, not `:3000`.**

---

## How to Resume

```bash
# 1. Start root API + frontend (whichever runs first grabs :3000)
cd /Users/manobendramandal/Desktop/code/projects/somnia && npm run dev &
cd /Users/manobendramandal/Desktop/code/projects/somnia/frontend && npm run dev &

# 2. Start watcher
cd /Users/manobendramandal/Desktop/code/projects/somnia/watcher && npm run dev &

# 3. Figure out which port has the API routes (DON'T assume — it flips):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/agent/leader/0xc3ef32972c265a82efef46097dff1289cbdee72e/latest-swap
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/agent/leader/0xc3ef32972c265a82efef46097dff1289cbdee72e/latest-swap
# whichever returns 200 is the root app — point ngrok there

# 4. Start/repoint ngrok to the root app's port, verify tunnel:
ngrok http <PORT>
curl -s -o /dev/null -w "%{http_code}\n" https://garnish-hardcopy-annotate.ngrok-free.dev/api/agent/leader/0xc3ef32972c265a82efef46097dff1289cbdee72e/latest-swap
# If the ngrok URL changed, re-run:
# NGROK_URL=https://xxx.ngrok-free.dev npx hardhat run scripts/setApiBase.ts --network somnia
# (VAULT_MANAGER in setApiBase.ts is currently 0x3672E7703B6A446d2c38878A227ca2f32Fa5d408)

# 5. Open the frontend UI on whichever port did NOT return 200 above,
#    create a fresh vault for the leader you want to follow, set keeper, fund it, swap.
```
