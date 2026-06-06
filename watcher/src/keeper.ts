import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount }                                       from 'viem/accounts';
import { somniaTestnet, VAULT_MANAGER_ADDRESS, KEEPER_PRIVATE_KEY } from './config.js';

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
] as const;

// STT sent with each call: JSON API (deposit + 0.09) + LLM (deposit + 0.21) ≈ 0.35+ STT
const AGENT_FEE = parseEther('0.4');

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
    console.log(`[keeper] Wallet: ${_account.address}`);
  }
  return { wallet: _walletClient!, account: _account!, public: _publicClient! };
}

export async function callCheckLeaderActivity(
  follower: string,
  leader:   string,
): Promise<void> {
  const { wallet, account, public: pub } = getClients();

  const hash = await wallet.writeContract({
    account,
    address:      VAULT_MANAGER_ADDRESS,
    abi:          VAULT_MANAGER_ABI,
    functionName: 'checkLeaderActivity',
    args:         [follower as `0x${string}`, leader as `0x${string}`],
    value:        AGENT_FEE,
    chain:        somniaTestnet,
  });

  console.log(
    `[keeper] checkLeaderActivity(${follower.slice(0, 8)}…, ${leader.slice(0, 8)}…) → ${hash}`
  );

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status === 'reverted') {
    throw new Error(`checkLeaderActivity reverted (tx: ${hash})`);
  }
  console.log(`[keeper] confirmed status=${receipt.status} block=${receipt.blockNumber}`);
}
