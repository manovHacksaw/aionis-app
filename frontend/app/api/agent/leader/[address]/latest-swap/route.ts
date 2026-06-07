import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

/**
 * GET /api/agent/leader/[address]/latest-swap
 *
 * Called by the Somnia JSON API Agent (JSON_API_AGENT_ID) inside
 * VaultManager.sol → checkLeaderActivity(), via:
 *
 *   payload = abi.encodeWithSelector(IJsonApiAgent.fetchString.selector,
 *                                    url, "swap.encoded")
 *
 * `swap.encoded` is a single ABI-encoded hex blob — `_hexStringToBytes` +
 * `abi.decode` on the contract side turns it straight back into
 * `(address tokenIn, address tokenOut, uint256 usdValue,
 *   uint256 tradePrice, uint256 tradeTimestamp)`. One `fetchString`
 * round-trip gets the whole tuple instead of chaining five single-field
 * fetches (the platform's JSON API agent only returns one typed value per call).
 *
 * Returns 404 if the leader has no recorded swaps yet.
 */
function encodeAddressWord(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function encodeUintWord(n: bigint): string {
  return n.toString(16).padStart(64, '0');
}

/** Manually ABI-encodes `(address, address, uint256, uint256, uint256)` — all
 *  fixed-size words, so this is just five concatenated 32-byte slots. */
function encodeSwapTuple(
  tokenIn: string,
  tokenOut: string,
  usdValueScaled: bigint,
  tradePriceScaled: bigint,
  timestamp: bigint
): string {
  return (
    '0x' +
    encodeAddressWord(tokenIn) +
    encodeAddressWord(tokenOut) +
    encodeUintWord(usdValueScaled) +
    encodeUintWord(tradePriceScaled) +
    encodeUintWord(timestamp)
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const leader = address.toLowerCase();

  const row = await prisma.leaderSwap.findFirst({
    where:   { leader },
    orderBy: { timestamp: 'desc' },
  });

  if (!row) {
    return NextResponse.json(
      { error: 'No swaps recorded for this leader yet.' },
      { status: 404 }
    );
  }

  const usdValueScaled   = BigInt(Math.round(Number(row.usdValue)   * 1e6));
  const tradePriceScaled = BigInt(Math.round(Number(row.wsomiPrice) * 1e10));
  const tradeTimestamp   = BigInt(Math.floor(new Date(row.timestamp).getTime() / 1000));

  const encoded = encodeSwapTuple(
    row.tokenIn,
    row.tokenOut,
    usdValueScaled,
    tradePriceScaled,
    tradeTimestamp
  );

  /**
   * Response shape — the JSON API agent extracts fields via dot-notation selectors.
   *
   * The contract fetches the whole tuple in one call:
   *   fetchString(url, "swap.encoded")
   *     → hex string of abi.encode(tokenIn, tokenOut, usdValue, tradePrice, tradeTimestamp)
   *       (usdValue scaled ×10^6, tradePrice scaled ×10^10, timestamp in unix seconds)
   *
   * The remaining fields are kept for human/debug inspection only — the
   * contract no longer reads them individually.
   */
  return NextResponse.json({
    swap: {
      leader:     row.leader,
      side:       row.side,
      token_in:   row.tokenIn,
      token_out:  row.tokenOut,
      usd_value:  Number(row.usdValue),
      price_raw:  Number(row.wsomiPrice),  // WSOMI price in USDC.e
      tx_hash:    row.txHash ?? '',
      timestamp:  Math.floor(new Date(row.timestamp).getTime() / 1000), // unix seconds
      encoded,
    },
  });
}
