import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

/**
 * GET /api/traders/search?address=0x...&window=24h
 *
 * Look up any wallet address and return their swap history + stats.
 * Works even if the address isn't in the leaderboard top 20.
 * Used by the frontend search bar so users can monitor any trader.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address')?.toLowerCase();
  const window  = searchParams.get('window') ?? '24h';

  if (!address || !/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  const WINDOWS: Record<string, number> = {
    '5m':  5  * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h':  1  * 60 * 60 * 1000,
    '6h':  6  * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    'all': Number.MAX_SAFE_INTEGER,
  };

  const ms    = WINDOWS[window] ?? WINDOWS['24h'];
  const since = new Date(Date.now() - ms);

  const [swaps, stats] = await Promise.all([
    // Last 50 swaps
    prisma.leaderSwap.findMany({
      where:   { leader: address, timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take:    50,
    }),
    // Aggregate stats
    prisma.leaderSwap.aggregate({
      where:   { leader: address, timestamp: { gte: since } },
      _count:  { id: true },
      _sum:    { usdValue: true },
    }),
  ]);

  return NextResponse.json({
    address,
    window,
    since:       since.toISOString(),
    found:       swaps.length > 0,
    stats: {
      trades:    stats._count.id,
      volume:    Number(stats._sum.usdValue ?? 0),
      buys:      swaps.filter((s) => s.side === 'BUY').length,
      sells:     swaps.filter((s) => s.side === 'SELL').length,
    },
    recentSwaps: swaps.map((s) => ({
      side:       s.side,
      tokenIn:    s.tokenIn,
      tokenOut:   s.tokenOut,
      usdValue:   Number(s.usdValue),
      wsomiPrice: Number(s.wsomiPrice),
      txHash:     s.txHash,
      timestamp:  s.timestamp,
    })),
  });
}
