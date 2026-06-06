import { sqrtPriceX96ToWsomiUsd } from './price.js';
import { POOL, STALE_BUY_MS, type PoolDef } from './config.js';

export type TradeSide = 'BUY' | 'SELL';

export interface SwapLog {
  sender:    `0x${string}`;
  recipient: `0x${string}`;
  amount0:   bigint;
  amount1:   bigint;
  price:     bigint;   // sqrtPriceX96 after swap
  liquidity: bigint;
  tick:      number;
  txHash:    `0x${string}`;
  blockTime: number;   // unix seconds
}

export interface TradeIntent {
  leader:     `0x${string}`;
  side:       TradeSide;
  tokenIn:    string;
  tokenOut:   string;
  usdValue:   number;
  wsomiPrice: number;
  txHash:     `0x${string}`;
  timestamp:  number;  // unix ms
  isStale:    boolean;
}

/**
 * Parse a Swap log for any pool.
 * `wsomiPriceCache` is required for pools with no stable token (e.g. NIA/WSOMI).
 *
 * amount0 < 0 → token0 leaving pool → user BUYing token0
 * amount0 > 0 → token0 entering pool → user SELLing token0
 */
export function parseSwapLog(
  log:             SwapLog,
  pool:            PoolDef,
  wsomiPriceCache: number,
): TradeIntent {
  const { token0, token1 } = pool;
  const ageMs = Date.now() - log.blockTime * 1000;

  // Derive WSOMI price from this event if the pool contains WSOMI
  const wsomiPrice =
    token0.symbol === 'WSOMI' || token1.symbol === 'WSOMI'
      ? sqrtPriceX96ToWsomiUsd(log.price)
      : wsomiPriceCache;

  // side: BUY = user receives token0 (amount0 negative)
  const isBuy = log.amount0 < 0n;
  const side: TradeSide = isBuy ? 'BUY' : 'SELL';
  const tokenIn  = isBuy ? token1.address : token0.address;
  const tokenOut = isBuy ? token0.address : token1.address;

  // USD value computation
  let usdValue: number;

  if (token1.isStable) {
    // WSOMI/USDC.e, WSOMI/USDT, NIA/USDT: amount1 is the stable side
    usdValue = Math.abs(Number(log.amount1)) / 10 ** token1.decimals;
  } else if (token0.isStable) {
    // USDC.e/NIA, USDC.e/USDT: amount0 is the stable side
    usdValue = Math.abs(Number(log.amount0)) / 10 ** token0.decimals;
  } else {
    // NIA/WSOMI — neither is stable; value WSOMI side at current price
    const wsomiSide =
      token0.symbol === 'WSOMI'
        ? Math.abs(Number(log.amount0)) / 10 ** token0.decimals
        : Math.abs(Number(log.amount1)) / 10 ** token1.decimals;
    usdValue = wsomiSide * wsomiPrice;
  }

  return {
    leader:     log.recipient,
    side,
    tokenIn,
    tokenOut,
    usdValue:   Math.abs(usdValue),
    wsomiPrice,
    txHash:     log.txHash,
    timestamp:  log.blockTime * 1000,
    isStale:    side === 'BUY' && ageMs > STALE_BUY_MS,
  };
}

// Legacy single-pool wrapper used by copy-engine
export function parseSwapLogLegacy(log: SwapLog): TradeIntent {
  const pool: PoolDef = { address: ADDRESSES_PLACEHOLDER, token0: POOL.token0, token1: POOL.token1, baseSymbol: 'WSOMI' };
  return parseSwapLog(log, pool, 0);
}

// Placeholder — copy-engine only calls parseSwapLog via processTrade which already has pool context
const ADDRESSES_PLACEHOLDER = '0x0000000000000000000000000000000000000000' as `0x${string}`;
