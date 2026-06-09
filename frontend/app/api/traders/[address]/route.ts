import { NextResponse }  from 'next/server';
import { prisma }        from '@/lib/prisma';
import { getWsomiPrice } from '@/lib/price';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const address = rawAddress.toLowerCase();
  const { searchParams } = new URL(_req.url);
  const followerParam = searchParams.get('follower')?.toLowerCase() ?? null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    copiedPositions,
    followerCount,
    wsomiPrice,
    swapAgg,
    swapSides,
    lastSwap,
    pnlSum,
    closedCount,
    winnersCount,
    recentSwaps,
  ] = await Promise.all([
    prisma.position.findMany({
      where:   { leader: address },
      orderBy: { openedAt: 'desc' },
      take:    10,
    }),
    prisma.userVault.count({
      where: { leader: address, status: { in: ['ACTIVE', 'PAUSED'] } }
    }),
    getWsomiPrice().catch(() => 0),
    prisma.leaderSwap.aggregate({
      where:  { leader: address, timestamp: { gte: since24h } },
      _count: { id: true },
      _sum:   { usdValue: true },
    }),
    prisma.leaderSwap.groupBy({
      by:    ['side'],
      where: { leader: address, timestamp: { gte: since24h } },
      _count: { id: true },
    }),
    prisma.leaderSwap.findFirst({
      where:   { leader: address },
      orderBy: { timestamp: 'desc' },
      select:  { timestamp: true },
    }),
    prisma.position.aggregate({
      where: { leader: address, status: 'CLOSED' },
      _sum: { pnl: true },
    }),
    prisma.position.count({
      where: { leader: address, status: 'CLOSED' },
    }),
    prisma.position.count({
      where: { leader: address, status: 'CLOSED', pnl: { gt: 0 } },
    }),
    prisma.leaderSwap.findMany({
      where: { leader: address },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }),
  ]);

  // Vault-specific stats when a follower address is provided (manage page)
  let vaultStats: {
    closedCount: number;
    winRate: number | null;
    totalPnl: number;
    openCount: number;
  } | null = null;

  if (followerParam) {
    const [vClosed, vWins, vOpen, vPnlAgg] = await Promise.all([
      prisma.position.count({ where: { leader: address, follower: followerParam, status: 'CLOSED' } }),
      prisma.position.count({ where: { leader: address, follower: followerParam, status: 'CLOSED', pnl: { gt: 0 } } }),
      prisma.position.count({ where: { leader: address, follower: followerParam, status: 'OPEN' } }),
      prisma.position.aggregate({ where: { leader: address, follower: followerParam, status: 'CLOSED' }, _sum: { pnl: true } }),
    ]);
    vaultStats = {
      closedCount: vClosed,
      winRate: vClosed > 0 ? Math.round((vWins / vClosed) * 100) : null,
      totalPnl: Number(vPnlAgg._sum.pnl ?? 0),
      openCount: vOpen,
    };
  }

  const buys  = swapSides.find((s) => s.side === 'BUY')?._count.id  ?? 0;
  const sells = swapSides.find((s) => s.side === 'SELL')?._count.id ?? 0;
  const totalProfitYielded = Number(pnlSum._sum.pnl ?? 0);

  return NextResponse.json({
    address,
    followerCount,
    wsomiPrice,
    totalProfitYielded,
    closedPositions: closedCount,
    winRate: closedCount > 0 ? Math.round((winnersCount / closedCount) * 100) : null,
    vaultStats,
    stats24h: {
      trades: swapAgg._count.id,
      volume: Number(swapAgg._sum.usdValue ?? 0),
      buys,
      sells,
    },
    lastSeen: lastSwap?.timestamp ?? null,
    recentTrades: copiedPositions.map((t) => ({
      id:             t.id,
      token:          t.token,
      ausdcAllocated: Number(t.ausdcAllocated),
      entryPrice:     Number(t.entryPrice),
      exitPrice:      t.exitPrice ? Number(t.exitPrice) : null,
      pnl:            t.pnl ? Number(t.pnl) : null,
      status:         t.status,
      txHashOpen:     t.txHashOpen,
      openedAt:       t.openedAt,
      closedAt:       t.closedAt,
    })),
    recentSwaps: recentSwaps.map((s) => ({
      id:         s.id,
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
