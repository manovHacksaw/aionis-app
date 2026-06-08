import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet, VAULT_MANAGER_ADDRESS, KEEPER_PRIVATE_KEY } from './config.js';
const VAULT_MANAGER_ABI = [
    {
        inputs: [
            { internalType: 'address', name: 'follower', type: 'address' },
            { internalType: 'address', name: 'leader', type: 'address' },
        ],
        name: 'checkLeaderActivity',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'follower', type: 'address' },
            { internalType: 'address', name: 'leader', type: 'address' },
        ],
        name: 'getOpenPositions',
        outputs: [{ internalType: 'bytes32[]', name: 'openIds', type: 'bytes32[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
        name: 'positions',
        outputs: [
            { internalType: 'address', name: 'follower', type: 'address' },
            { internalType: 'address', name: 'leader', type: 'address' },
            { internalType: 'bytes32', name: 'vaultId', type: 'bytes32' },
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: 'ausdAllocated', type: 'uint256' },
            { internalType: 'uint256', name: 'entryPrice', type: 'uint256' },
            { internalType: 'uint256', name: 'exitPrice', type: 'uint256' },
            { internalType: 'int256', name: 'pnl', type: 'int256' },
            { internalType: 'uint8', name: 'status', type: 'uint8' },
            { internalType: 'uint256', name: 'openedAt', type: 'uint256' },
            { internalType: 'uint256', name: 'closedAt', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'bytes32', name: 'positionId', type: 'bytes32' }],
        name: 'closePosition',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
        name: 'updatePrice',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'latestPrice',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
];
// STT sent with each call: JSON API (deposit + 0.09) + LLM (deposit + 0.21) ≈ 0.35+ STT
const AGENT_FEE = parseEther('0.4');
// updatePrice needs >= opDeposit (0.03) + 0.09 ≈ 0.12 STT for its single JSON API call
const PRICE_FEE = parseEther('0.15');
let _account = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletClient = null;
let _publicClient = null;
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
            account: _account,
            chain: somniaTestnet,
            transport: http('https://dream-rpc.somnia.network/'),
        });
        _publicClient = createPublicClient({
            chain: somniaTestnet,
            transport: http('https://dream-rpc.somnia.network/'),
        });
        console.log(`[keeper] Wallet: ${_account.address}`);
    }
    return { wallet: _walletClient, account: _account, public: _publicClient };
}
export async function callCheckLeaderActivity(follower, leader) {
    const { wallet, account, public: pub } = getClients();
    const hash = await wallet.writeContract({
        account,
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'checkLeaderActivity',
        args: [follower, leader],
        value: AGENT_FEE,
        chain: somniaTestnet,
    });
    console.log(`[keeper] checkLeaderActivity(${follower.slice(0, 8)}…, ${leader.slice(0, 8)}…) → ${hash}`);
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status === 'reverted') {
        throw new Error(`checkLeaderActivity reverted (tx: ${hash})`);
    }
    console.log(`[keeper] confirmed status=${receipt.status} block=${receipt.blockNumber}`);
}
/**
 * Returns the IDs of the follower's currently-OPEN on-chain positions in
 * `token` (the asset the leader is now exiting). Reads straight from the
 * contract — there's no off-chain mirror of on-chain `Position` rows.
 */
export async function getOpenPositionIdsForToken(follower, leader, token) {
    const { public: pub } = getClients();
    const openIds = await pub.readContract({
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'getOpenPositions',
        args: [follower, leader],
    });
    const matches = [];
    for (const id of openIds) {
        const pos = await pub.readContract({
            address: VAULT_MANAGER_ADDRESS,
            abi: VAULT_MANAGER_ABI,
            functionName: 'positions',
            args: [id],
        });
        if (pos[3].toLowerCase() === token.toLowerCase())
            matches.push(id);
    }
    return matches;
}
export async function callUpdatePrice(token) {
    const { wallet, account, public: pub } = getClients();
    const hash = await wallet.writeContract({
        account,
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'updatePrice',
        args: [token],
        value: PRICE_FEE,
        chain: somniaTestnet,
    });
    console.log(`[keeper] updatePrice(${token.slice(0, 10)}…) → ${hash}`);
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status === 'reverted') {
        throw new Error(`updatePrice reverted (tx: ${hash})`);
    }
    console.log(`[keeper] confirmed status=${receipt.status} block=${receipt.blockNumber}`);
}
/**
 * Polls latestPrice[token] until the JSON API agent's onPriceUpdate callback
 * lands it on-chain (validator consensus typically takes well under a minute,
 * but can run longer). Throws if it hasn't landed within `timeoutMs`.
 */
export async function waitForPrice(token, timeoutMs = 180_000, pollMs = 5_000) {
    const { public: pub } = getClients();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const price = await pub.readContract({
            address: VAULT_MANAGER_ADDRESS,
            abi: VAULT_MANAGER_ABI,
            functionName: 'latestPrice',
            args: [token],
        });
        if (price > 0n)
            return price;
        await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`waitForPrice(${token.slice(0, 10)}…) timed out after ${timeoutMs}ms`);
}
export async function callClosePosition(positionId) {
    const { wallet, account, public: pub } = getClients();
    const hash = await wallet.writeContract({
        account,
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'closePosition',
        args: [positionId],
        chain: somniaTestnet,
    });
    console.log(`[keeper] closePosition(${positionId.slice(0, 10)}…) → ${hash}`);
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status === 'reverted') {
        throw new Error(`closePosition reverted (tx: ${hash})`);
    }
    console.log(`[keeper] confirmed status=${receipt.status} block=${receipt.blockNumber}`);
}
