import { createPublicClient, http } from 'viem';
import { somniaMainnet, ADDRESSES, POOL } from './config.js';
export const ALGEBRA_POOL_ABI = [
    {
        inputs: [],
        name: 'globalState',
        outputs: [
            { name: 'price', type: 'uint160' },
            { name: 'tick', type: 'int24' },
            { name: 'fee', type: 'uint16' },
            { name: 'timepointIndex', type: 'uint16' },
            { name: 'communityFeeToken0', type: 'uint8' },
            { name: 'communityFeeToken1', type: 'uint8' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
];
export const ALGEBRA_SWAP_ABI = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'sender', type: 'address' },
            { indexed: true, name: 'recipient', type: 'address' },
            { indexed: false, name: 'amount0', type: 'int256' },
            { indexed: false, name: 'amount1', type: 'int256' },
            { indexed: false, name: 'price', type: 'uint160' },
            { indexed: false, name: 'liquidity', type: 'uint128' },
            { indexed: false, name: 'tick', type: 'int24' },
        ],
        name: 'Swap',
        type: 'event',
    },
];
/**
 * Converts Algebra V3 sqrtPriceX96 → human-readable WSOMI price in USDC.e.
 * token0=WSOMI (18 dec), token1=USDC.e (6 dec)
 */
export function sqrtPriceX96ToWsomiUsd(sqrtPriceX96) {
    const raw = Number(sqrtPriceX96) / 2 ** 96;
    return raw * raw * Math.pow(10, POOL.token0.decimals - POOL.token1.decimals);
}
const httpClient = createPublicClient({
    chain: somniaMainnet,
    transport: http('https://api.infra.mainnet.somnia.network/'),
});
export async function getCurrentWsomiPrice() {
    const state = await httpClient.readContract({
        address: ADDRESSES.wsomiUsdcePool,
        abi: ALGEBRA_POOL_ABI,
        functionName: 'globalState',
    });
    return sqrtPriceX96ToWsomiUsd(state[0]);
}
