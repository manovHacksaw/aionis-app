import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

// GET /api/profile/[address]
// Aggregated profile for a wallet: bio/avatar, follower count (as a leader),
// the leaders this address follows, and copy-trading stats (trades + P&L).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const address = rawAddress.toLowerCase();

  const [profile, followerCount, following, closedAgg, openPositions, tradeCount] = await Promise.all([
    prisma.followerProfile.findUnique({
      where:  { follower: address },
      select: { avatarUrl: true, bio: true, createdAt: true },
    }),
    prisma.userVault.count({
      where: { leader: address, status: { in: ['ACTIVE', 'PAUSED'] } },
    }),
    prisma.userVault.findMany({
      where:   { follower: address },
      orderBy: { createdAt: 'desc' },
      select:  { leader: true, status: true, ausdcLocked: true, riskLevel: true, createdAt: true },
    }),
    prisma.position.aggregate({
      where: { follower: address, status: 'CLOSED' },
      _sum:  { pnl: true },
    }),
    prisma.position.findMany({
      where:  { follower: address, status: 'OPEN' },
      select: { token: true, ausdcAllocated: true, entryPrice: true },
    }),
    prisma.position.count({ where: { follower: address } }),
  ]);

  const tokens = [...new Set(openPositions.map((p) => p.token))];
  const priceRows = tokens.length
    ? await prisma.tokenPrice.findMany({ where: { token: { in: tokens } } })
    : [];
  const priceMap: Record<string, number> = {};
  for (const row of priceRows) priceMap[row.token] = Number(row.price);

  let unrealizedPnl = 0;
  for (const pos of openPositions) {
    const entry   = Number(pos.entryPrice);
    const current = priceMap[pos.token] ?? entry;
    if (entry > 0) {
      unrealizedPnl += (Number(pos.ausdcAllocated) * current) / entry - Number(pos.ausdcAllocated);
    }
  }

  return NextResponse.json({
    address,
    avatarUrl: profile?.avatarUrl ?? null,
    bio: profile?.bio ?? null,
    memberSince: profile?.createdAt ?? null,
    followerCount,
    following: following.map((f) => ({
      leader:      f.leader,
      status:      f.status,
      ausdcLocked: Number(f.ausdcLocked),
      riskLevel:   f.riskLevel,
      since:       f.createdAt,
    })),
    stats: {
      tradesOpened:  tradeCount,
      realizedPnl:   Number(closedAgg._sum.pnl ?? 0),
      unrealizedPnl: +unrealizedPnl.toFixed(6),
    },
  });
}
