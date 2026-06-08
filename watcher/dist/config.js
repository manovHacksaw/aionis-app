import 'dotenv/config';
import { defineChain } from 'viem';
// ── Chains ────────────────────────────────────────────────────────────────────
export const somniaMainnet = defineChain({
    id: 5031,
    name: 'Somnia Mainnet',
    nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
    rpcUrls: {
        default: {
            http: ['https://api.infra.mainnet.somnia.network/'],
            webSocket: ['wss://api.infra.mainnet.somnia.network/ws'],
        },
    },
});
// ── Tokens (Somnia Mainnet) ───────────────────────────────────────────────────
export const TOKENS = {
    WSOMI: { address: '0x046EDe9564A72571df6F5e44d0405360c0f4dCab', symbol: 'WSOMI', decimals: 18, isStable: false },
    USDCE: { address: '0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00', symbol: 'USDC.e', decimals: 6, isStable: true },
    NIA: { address: '0xC063B29CD6B30885783B505aE180B3079e0A2154', symbol: 'NIA', decimals: 18, isStable: false },
    USDT: { address: '0x67B302E35Aef5EEE8c32D934F5856869EF428330', symbol: 'USDT', decimals: 6, isStable: true },
};
export const POOLS = [
    {
        address: '0xe5467Be8B8Db6B074904134E8C1a581F5565E2c3',
        token0: TOKENS.WSOMI,
        token1: TOKENS.USDCE,
        baseSymbol: 'WSOMI',
    },
    {
        address: '0xb1a5a70A946667655bF14512599D06ACCa020F62',
        token0: TOKENS.WSOMI,
        token1: TOKENS.USDCE,
        baseSymbol: 'WSOMI',
    },
    {
        address: '0x89b6827843b884B862489C2FC526374D0F9F1c39',
        token0: TOKENS.USDCE,
        token1: TOKENS.NIA,
        baseSymbol: 'NIA',
    },
    {
        address: '0xb29713414Fd01604A3B4267b0D6df67dFa9E151b',
        token0: TOKENS.WSOMI,
        token1: TOKENS.NIA,
        baseSymbol: 'NIA',
    },
    {
        address: '0x6594c878AB49266bA03A3131D89B9515F02A412f',
        token0: TOKENS.USDCE,
        token1: TOKENS.USDT,
        baseSymbol: 'USDT',
    },
    {
        address: '0x6b3D46a456D04E51d138E22888B4EF9eb2266F42',
        token0: TOKENS.WSOMI,
        token1: TOKENS.USDT,
        baseSymbol: 'USDT',
    },
];
// Kept for backwards-compat with copy-engine (still targets WSOMI/USDC.e)
export const ADDRESSES = {
    algebraFactory: '0x0ccff3D02A3a200263eC4e0Fdb5E60a56721B8Ae',
    swapRouter: '0x1582f6f3D26658F7208A799Be46e34b1f366CE44',
    wsomi: TOKENS.WSOMI.address,
    usdce: TOKENS.USDCE.address,
    wsomiUsdcePool: '0xe5467Be8B8Db6B074904134E8C1a581F5565E2c3',
};
// Kept for copy-engine backwards-compat
export const POOL = {
    token0: TOKENS.WSOMI,
    token1: TOKENS.USDCE,
};
// ── Somnia Testnet (where VaultManager lives) ─────────────────────────────────
export const somniaTestnet = defineChain({
    id: 50312,
    name: 'Somnia Shannon Testnet',
    nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
    rpcUrls: {
        default: {
            http: ['https://dream-rpc.somnia.network/'],
            webSocket: ['wss://dream-rpc.somnia.network/ws'],
        },
    },
});
// ── On-chain keeper config ────────────────────────────────────────────────────
export const VAULT_MANAGER_ADDRESS = (process.env.VAULT_MANAGER_ADDRESS ?? '');
export const KEEPER_PRIVATE_KEY = (process.env.KEEPER_PRIVATE_KEY ?? '');
// ── Copy-trade config ─────────────────────────────────────────────────────────
export const DEFAULT_COPY_PCT = Number(process.env.DEFAULT_COPY_PCT ?? 20);
export const STALE_BUY_MS = 10_000; // skip BUYs older than 10s
