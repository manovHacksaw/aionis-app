import { createPublicClient, http } from 'viem';
import { somniaMainnet, ADDRESSES, POOL } from './config.js';

export const ALGEBRA_POOL_ABI = [
  {
    inputs: [],
    name: 'globalState',
    outputs: [
      { name: 'price',              type: 'uint160' },
      { name: 'tick',               type: 'int24'   },
      { name: 'fee',                type: 'uint16'  },
      { name: 'timepointIndex',     type: 'uint16'  },
      { name: 'communityFeeToken0', type: 'uint8'   },
      { name: 'communityFeeToken1', type: 'uint8'   },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ALGEBRA_SWAP_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: 'sender',    type: 'address' },
      { indexed: true,  name: 'recipient', type: 'address' },
      { indexed: false, name: 'amount0',   type: 'int256'  },
      { indexed: false, name: 'amount1',   type: 'int256'  },
      { indexed: false, name: 'price',     type: 'uint160' },
      { indexed: false, name: 'liquidity', type: 'uint128' },
      { indexed: false, name: 'tick',      type: 'int24'   },
    ],
    name: 'Swap',
    type: 'event',
  },
] as const;

/**
 * Converts Algebra V3 sqrtPriceX96 → human-readable WSOMI price in USDC.e.
 * token0=WSOMI (18 dec), token1=USDC.e (6 dec)
 */
export function sqrtPriceX96ToWsomiUsd(sqrtPriceX96: bigint): number {
  const raw = Number(sqrtPriceX96) / 2 ** 96;
  return raw * raw * Math.pow(10, POOL.token0.decimals - POOL.token1.decimals);
}

const httpClient = createPublicClient({
  chain:     somniaMainnet,
  transport: http('https://api.infra.mainnet.somnia.network/'),
});

export async function getCurrentWsomiPrice(): Promise<number> {
  const state = await httpClient.readContract({
    address:      ADDRESSES.wsomiUsdcePool,
    abi:          ALGEBRA_POOL_ABI,
    functionName: 'globalState',
  });
  return sqrtPriceX96ToWsomiUsd(state[0]);
}

// USDC.e/NIA pool — token0=USDC.e (6 dec), token1=NIA (18 dec)
// NIA price in USDC.e = 1e12 / (sqrtP/2^96)^2
export async function getCurrentNiaPrice(): Promise<number> {
  const state = await httpClient.readContract({
    address:      '0x89b6827843b884B862489C2FC526374D0F9F1c39' as `0x${string}`,
    abi:          ALGEBRA_POOL_ABI,
    functionName: 'globalState',
  });
  const raw = Number(state[0]) / 2 ** 96;
  return 1e12 / (raw * raw);
}
