import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

// Time windows supported
const WINDOWS: Record<string, number> = {
  '5m':  5  * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h':  1  * 60 * 60 * 1000,
  '6h':  6  * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const window = searchParams.get('window') ?? '1h';
  const ms     = WINDOWS[window];

  if (!ms) {
    return NextResponse.json(
      { error: `Invalid window. Use: ${Object.keys(WINDOWS).join(', ')}` },
      { status: 400 }
    );
  }

  const since = new Date(Date.now() - ms);

  // Aggregate per trader for the requested window
  const rows = await prisma.leaderSwap.groupBy({
    by:      ['leader'],
    where:   { timestamp: { gte: since } },
    _count:  { id: true },
    _sum:    { usdValue: true },
    orderBy: { _sum: { usdValue: 'desc' } },
    take:    20,
  });

  if (rows.length === 0) {
    return NextResponse.json({ window, since: since.toISOString(), traders: [] });
  }

  // Fetch latest swap + buy/sell breakdown per trader
  const leaders = rows.map((r) => r.leader);

  const [latestSwaps, sideCounts] = await Promise.all([
    // Most recent swap for each leader
    Promise.all(
      leaders.map((leader) =>
        prisma.leaderSwap.findFirst({
          where:   { leader, timestamp: { gte: since } },
          orderBy: { timestamp: 'desc' },
          select:  { side: true, usdValue: true, wsomiPrice: true, timestamp: true },
        })
      )
    ),
    // Buy vs Sell count per leader
    prisma.leaderSwap.groupBy({
      by:    ['leader', 'side'],
      where: { leader: { in: leaders }, timestamp: { gte: since } },
      _count: { id: true },
    }),
  ]);

  // Build side count map
  const sideMap: Record<string, { BUY: number; SELL: number }> = {};
  for (const row of sideCounts) {
    if (!sideMap[row.leader]) sideMap[row.leader] = { BUY: 0, SELL: 0 };
    sideMap[row.leader][row.side as 'BUY' | 'SELL'] = row._count.id;
  }

  const traders = rows.map((row, i) => ({
    rank:       i + 1,
    address:    row.leader,
    trades:     row._count.id,
    volume:     Number(row._sum.usdValue ?? 0),
    buys:       sideMap[row.leader]?.BUY  ?? 0,
    sells:      sideMap[row.leader]?.SELL ?? 0,
    lastSide:   latestSwaps[i]?.side,
    lastPrice:  latestSwaps[i]?.wsomiPrice ? Number(latestSwaps[i]!.wsomiPrice) : null,
    lastVolume: latestSwaps[i]?.usdValue   ? Number(latestSwaps[i]!.usdValue) : null,
    lastSeen:   latestSwaps[i]?.timestamp  ?? null,
  }));

  return NextResponse.json({ window, since: since.toISOString(), traders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[leaderboard]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
