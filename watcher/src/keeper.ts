import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount }                                                    from 'viem/accounts';
import { somniaTestnet, VAULT_MANAGER_ADDRESS, KEEPER_PRIVATE_KEY }              from './config.js';
import { log, warn, error as logError }                                           from './logger.js';
import { incrStat, STAT_EXECUTIONS }                                              from './stats.js';

const VAULT_MANAGER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'follower', type: 'address' },
      { internalType: 'address', name: 'leader',   type: 'address' },
    ],
    name:            'checkLeaderActivity',
    outputs:         [],
    stateMutability: 'payable',
    type:            'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'follower', type: 'address' },
      { internalType: 'address', name: 'leader',   type: 'address' },
    ],
    name:            'getOpenPositions',
    outputs:         [{ internalType: 'bytes32[]', name: 'openIds', type: 'bytes32[]' }],
    stateMutability: 'view',
    type:            'function',
  },
  {
    inputs:  [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name:    'positions',
    outputs: [
      { internalType: 'address',        name: 'follower',      type: 'address' },
      { internalType: 'address',        name: 'leader',        type: 'address' },
      { internalType: 'bytes32',        name: 'vaultId',       type: 'bytes32' },
      { internalType: 'address',        name: 'token',         type: 'address' },
      { internalType: 'uint256',        name: 'ausdAllocated', type: 'uint256' },
      { internalType: 'uint256',        name: 'entryPrice',    type: 'uint256' },
      { internalType: 'uint256',        name: 'exitPrice',     type: 'uint256' },
      { internalType: 'int256',         name: 'pnl',           type: 'int256'  },
      { internalType: 'uint8',          name: 'status',        type: 'uint8'   },
      { internalType: 'uint256',        name: 'openedAt',      type: 'uint256' },
      { internalType: 'uint256',        name: 'closedAt',      type: 'uint256' },
    ],
    stateMutability: 'view',
    type:            'function',
  },
  {
    inputs:          [{ internalType: 'bytes32', name: 'positionId', type: 'bytes32' }],
    name:            'closePosition',
    outputs:         [],
    stateMutability: 'nonpayable',
    type:            'function',
  },
  {
    inputs:          [{ internalType: 'address', name: 'token', type: 'address' }],
    name:            'updatePrice',
    outputs:         [],
    stateMutability: 'payable',
    type:            'function',
  },
  {
    inputs:  [{ internalType: 'address', name: '', type: 'address' }],
    name:    'latestPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type:    'function',
  },
] as const;

// STT sent with each call: JSON API (deposit + 0.09) + LLM (deposit + 0.21) ≈ 0.35+ STT
const AGENT_FEE = parseEther('0.4');

// updatePrice needs >= opDeposit (0.03) + 0.09 ≈ 0.12 STT for its single JSON API call
const PRICE_FEE = parseEther('0.15');

type Account = ReturnType<typeof privateKeyToAccount>;

let _account:      Account | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletClient: any | null = null;
let _publicClient: ReturnType<typeof createPublicClient> | null = null;

function getClients() {
  if (!KEEPER_PRIVATE_KEY || KEEPER_PRIVATE_KEY === '0x') {
    throw new Error('[keeper] KEEPER_PRIVATE_KEY not configured');
  }
  if (!VAULT_MANAGER_ADDRESS || VAULT_MANAGER_ADDRESS === '0x') {
    throw new Error('[keeper] VAULT_MANAGER_ADDRESS not configured');
  }
  if (!_walletClient) {
    _account = privateKeyToAccount(KEEPER_PRIVATE_KEY);
    _walletClient = createWalletClient({
      account:   _account,
      chain:     somniaTestnet,
      transport: http('https://dream-rpc.somnia.network/'),
    });
    _publicClient = createPublicClient({
      chain:     somniaTestnet,
      transport: http('https://dream-rpc.somnia.network/'),
    });
    log('keeper', `Wallet initialised: ${_account.address}`);
  }
  return { wallet: _walletClient!, account: _account!, public: _publicClient! };
}

/** Returns the keeper wallet address and live STT balance — used by startup diagnostics. */
export async function getKeeperInfo(): Promise<{ address: string; balanceEth: string }> {
  const { account, public: pub } = getClients();
  const balance = await pub.getBalance({ address: account.address });
  return { address: account.address, balanceEth: formatEther(balance) };
}

export async function callCheckLeaderActivity(
  follower: string,
  leader:   string,
): Promise<void> {
  const { wallet, account, public: pub } = getClients();

  // Pre-flight: check balance before submitting — catch underfunding before it reverts on-chain.
  const balance  = await pub.getBalance({ address: account.address });
  const minNeeded = AGENT_FEE + parseEther('0.02'); // 0.02 STT gas buffer
  log('keeper', `checkLeaderActivity follower=${follower.slice(0, 10)}… leader=${leader.slice(0, 10)}…  wallet balance=${formatEther(balance)} STT  fee=${formatEther(AGENT_FEE)} STT`);
  if (balance < minNeeded) {
    warn('keeper', `UNDERFUNDED — balance ${formatEther(balance)} STT < required ~${formatEther(minNeeded)} STT. Aborting call to avoid on-chain revert.`);
    throw new Error(`Keeper wallet underfunded: ${formatEther(balance)} STT available, ~${formatEther(minNeeded)} STT needed`);
  }
  if (balance < parseEther('1')) {
    warn('keeper', `Low keeper balance (${formatEther(balance)} STT) — top up soon to avoid future failures`);
  }

  let hash: `0x${string}`;
  try {
    hash = await wallet.writeContract({
      account,
      address:      VAULT_MANAGER_ADDRESS,
      abi:          VAULT_MANAGER_ABI,
      functionName: 'checkLeaderActivity',
      args:         [follower as `0x${string}`, leader as `0x${string}`],
      value:        AGENT_FEE,
      chain:        somniaTestnet,
    });
  } catch (e) {
    logError('keeper', `checkLeaderActivity tx submission failed — follower=${follower.slice(0, 10)}… leader=${leader.slice(0, 10)}…`, e);
    throw e;
  }

  log('keeper', `checkLeaderActivity tx submitted → ${hash}  (awaiting receipt…)`);

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status === 'reverted') {
    logError('keeper', `checkLeaderActivity REVERTED — tx=${hash}  block=${receipt.blockNumber}  gas_used=${receipt.gasUsed}`);
    throw new Error(`checkLeaderActivity reverted (tx: ${hash})`);
  }
  log('keeper', `checkLeaderActivity confirmed ✓  block=${receipt.blockNumber}  gas_used=${receipt.gasUsed}  tx=${hash}`);
  incrStat(STAT_EXECUTIONS);
}

/**
 * Returns the IDs of the follower's currently-OPEN on-chain positions in
 * `token` (the asset the leader is now exiting). Reads straight from the
 * contract — there's no off-chain mirror of on-chain `Position` rows.
 */
export async function getOpenPositionIdsForToken(
  follower: string,
  leader:   string,
  token:    string,
): Promise<`0x${string}`[]> {
  const { public: pub } = getClients();

  const openIds = await pub.readContract({
    address:      VAULT_MANAGER_ADDRESS,
    abi:          VAULT_MANAGER_ABI,
    functionName: 'getOpenPositions',
    args:         [follower as `0x${string}`, leader as `0x${string}`],
  });

  const matches: `0x${string}`[] = [];
  for (const id of openIds) {
    const pos = await pub.readContract({
      address:      VAULT_MANAGER_ADDRESS,
      abi:          VAULT_MANAGER_ABI,
      functionName: 'positions',
      args:         [id],
    });
    if (pos[3].toLowerCase() === token.toLowerCase()) matches.push(id);
  }
  return matches;
}

export async function callUpdatePrice(token: string): Promise<void> {
  const { wallet, account, public: pub } = getClients();

  const balance = await pub.getBalance({ address: account.address });
  log('keeper', `updatePrice token=${token.slice(0, 10)}…  wallet balance=${formatEther(balance)} STT  fee=${formatEther(PRICE_FEE)} STT`);
  if (balance < PRICE_FEE + parseEther('0.01')) {
    warn('keeper', `UNDERFUNDED for updatePrice — balance ${formatEther(balance)} STT < required ~${formatEther(PRICE_FEE + parseEther('0.01'))} STT`);
    throw new Error(`Keeper wallet underfunded for updatePrice: ${formatEther(balance)} STT available`);
  }

  let hash: `0x${string}`;
  try {
    hash = await wallet.writeContract({
      account,
      address:      VAULT_MANAGER_ADDRESS,
      abi:          VAULT_MANAGER_ABI,
      functionName: 'updatePrice',
      args:         [token as `0x${string}`],
      value:        PRICE_FEE,
      chain:        somniaTestnet,
    });
  } catch (e) {
    logError('keeper', `updatePrice tx submission failed — token=${token.slice(0, 10)}…`, e);
    throw e;
  }

  log('keeper', `updatePrice tx submitted → ${hash}  (awaiting receipt…)`);

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status === 'reverted') {
    logError('keeper', `updatePrice REVERTED — tx=${hash}  block=${receipt.blockNumber}`);
    throw new Error(`updatePrice reverted (tx: ${hash})`);
  }
  log('keeper', `updatePrice confirmed ✓  block=${receipt.blockNumber}  gas_used=${receipt.gasUsed}  tx=${hash}`);
}

/**
 * Polls latestPrice[token] until the JSON API agent's onPriceUpdate callback
 * lands it on-chain (validator consensus typically takes well under a minute,
 * but can run longer). Throws if it hasn't landed within `timeoutMs`.
 */
export async function waitForPrice(
  token:     string,
  timeoutMs = 180_000,
  pollMs    = 5_000,
): Promise<bigint> {
  const { public: pub } = getClients();
  const deadline  = Date.now() + timeoutMs;
  let   attempts  = 0;

  log('keeper', `waitForPrice token=${token.slice(0, 10)}…  timeout=${timeoutMs / 1000}s  poll=${pollMs / 1000}s`);

  while (Date.now() < deadline) {
    attempts++;
    const price = await pub.readContract({
      address:      VAULT_MANAGER_ADDRESS,
      abi:          VAULT_MANAGER_ABI,
      functionName: 'latestPrice',
      args:         [token as `0x${string}`],
    });
    if (price > 0n) {
      log('keeper', `waitForPrice resolved after ${attempts} poll(s) — latestPrice=${price}  token=${token.slice(0, 10)}…`);
      return price;
    }
    log('keeper', `waitForPrice attempt ${attempts} — price not yet on-chain, retrying in ${pollMs / 1000}s…`);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  logError('keeper', `waitForPrice TIMED OUT after ${attempts} poll(s) (${timeoutMs / 1000}s) — token=${token.slice(0, 10)}…`);
  throw new Error(`waitForPrice(${token.slice(0, 10)}…) timed out after ${timeoutMs}ms`);
}

export async function callClosePosition(positionId: `0x${string}`): Promise<void> {
  const { wallet, account, public: pub } = getClients();

  log('keeper', `closePosition positionId=${positionId.slice(0, 18)}…`);

  let hash: `0x${string}`;
  try {
    hash = await wallet.writeContract({
      account,
      address:      VAULT_MANAGER_ADDRESS,
      abi:          VAULT_MANAGER_ABI,
      functionName: 'closePosition',
      args:         [positionId],
      chain:        somniaTestnet,
    });
  } catch (e) {
    logError('keeper', `closePosition tx submission failed — positionId=${positionId.slice(0, 18)}…`, e);
    throw e;
  }

  log('keeper', `closePosition tx submitted → ${hash}  (awaiting receipt…)`);

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status === 'reverted') {
    logError('keeper', `closePosition REVERTED — positionId=${positionId.slice(0, 18)}…  tx=${hash}  block=${receipt.blockNumber}`);
    throw new Error(`closePosition reverted (tx: ${hash})`);
  }
  log('keeper', `closePosition confirmed ✓  positionId=${positionId.slice(0, 18)}…  block=${receipt.blockNumber}  gas_used=${receipt.gasUsed}  tx=${hash}`);
  incrStat(STAT_EXECUTIONS);
}
