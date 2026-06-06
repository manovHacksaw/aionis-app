# Aionis — Session Progress & Open Issues

## Deployed Contracts (Somnia Shannon Testnet, chain 50312)

| Contract | Address |
|----------|---------|
| VaultManager (current) | `0x5f0EA2dd5BE70F22375D42034d543C3f91B49667` |
| aUSD | `0xaE2DE61038F8086293134e33615C7761933F81E4` |
| Keeper wallet | `0x842056bb847BCe24bEb6D0d08703024DBa94CCE9` |
| Deployer wallet | `0x7DcF628f79676ec5755Da9EF1fb312460E1599E4` |
| Somnia Agent Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |

**Previous (dead) VaultManagers:**
- `0x070f3A3BceAB706dD1cFB64cF14854c14e109e0F` — first deploy
- `0x93fF8B81111BaBc5001a9cC6385895f1AE5A2E74` — second deploy (stuck pipeline)
- `0x24108C322FeDD9e86B447Bb74f641483454d25ab` — third deploy (localhost API_BASE bug)

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
- **Frontend (UI)**: `localhost:3000` — runs from `frontend/` directory
- **Root app (API routes)**: `localhost:3001` — runs from project root `src/`
- **Watcher**: `watcher/src/index.ts`

> **Critical**: Next.js 16 in `frontend/` detects monorepo root at `/somnia/` and reads
> env from **root `.env.local`**, NOT `frontend/.env.local`. Always update the root file.

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

## Current Open Issue (tackle in morning)

### "VM: vault not active" on `checkLeaderActivity`

**Error:**
```
checkLeaderActivity(0xfd3495db0fdb7b60fc7915768488d2bafe5aa383, 0xc3ef32...)
→ reverted: VM: vault not active
```

**What we know:**
- The DB has a UserVault with `follower=0xfd3495...`, `status=ACTIVE`, `ausdcLocked=200`
- The watcher reads from DB → fires keeper with `follower=0xfd3495...`
- The on-chain contract `0x5f0EA2dd5BE70F22375D42034d543C3f91B49667` reverts "vault not active"
  - This means the vault EXISTS on-chain but has status PAUSED (1) or CLOSED (2)
  - (If it didn't exist, status would be 0 = ACTIVE → would pass, then fail on `_freeBalance`)
- The connected browser wallet is `0xDd97...6502` — different from `0xfd3495...`
- `0xfd3495...` is likely a Privy embedded wallet; `0xDd97...6502` is the external wallet

**Most likely cause:**
The user's Privy setup has TWO wallets:
- `0xfd3495...` — Privy embedded wallet (used for on-chain tx signing for vault creation)
- `0xDd97...6502` — external/connected wallet (shown in top-right)

The vault was created and then paused (user clicked "Pause" or the UI auto-paused it).
The vault on the new contract has `status = PAUSED`.

**To verify in morning:**
```bash
# Check vault status on-chain for 0xfd3495...
node -e "
const {createPublicClient,http,getAddress}=require('viem');
const c=createPublicClient({transport:http('https://dream-rpc.somnia.network/')});
c.readContract({
  address:'0x5f0EA2dd5BE70F22375D42034d543C3f91B49667',
  abi:[{name:'getVault',type:'function',stateMutability:'view',inputs:[{name:'follower',type:'address'},{name:'leader',type:'address'}],outputs:[{name:'',type:'tuple',components:[{name:'follower',type:'address'},{name:'ausdLocked',type:'uint256'},{name:'status',type:'uint8'}]}]}],
  functionName:'getVault',
  args:['0xFD3495Db4E1cD2E7D06a9AC0Ad5B31c4c4e3eb29','0xc3ef32972c265a82efef46097dff1289cbdee72e']
}).then(v=>console.log('status:',v.status,'locked:',Number(v.ausdLocked)/1e6));
"
```

**Fix options:**
1. If vault is PAUSED → user calls `resumeVault(leader)` from frontend
2. If vault was created with wrong token addresses in allowlist → check `getAllowlist`
3. If vault doesn't actually exist (status=0=ACTIVE but balance=0) → the revert would be "insufficient free balance" not "vault not active" — so this case is ruled out

**Also check tomorrow:**
- Keeper STT balance: `0x842056...` had only 0.19 STT, needs 0.4 STT per call
- Keeper must be set on-chain: `keeperOf(0xfd3495...) == 0x842056...`

---

## How to Resume Tomorrow

```bash
# 1. Start root API (port 3001 — what ngrok tunnels to)
cd /Users/manobendramandal/Desktop/code/projects/somnia
npm run dev   # starts on 3001 (3000 will be taken by frontend)

# 2. Start frontend UI (port 3000)
cd /Users/manobendramandal/Desktop/code/projects/somnia/frontend
npm run dev

# 3. Start watcher
cd /Users/manobendramandal/Desktop/code/projects/somnia/watcher
npm run dev

# 4. Make sure ngrok is running
# ngrok http 3001  (or use existing tunnel if still active)
# Then update API_BASE on contract if ngrok URL changed:
# NGROK_URL=https://xxx.ngrok-free.dev npx hardhat run scripts/setApiBase.ts --network somnia

# 5. Check vault status and resume if paused (see "Current Open Issue" above)
```
