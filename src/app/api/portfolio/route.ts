import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

// GET /api/portfolio?address=0x...
// Portfolio summary for a follower: total locked, total unrealized P&L,
// active vault count, and a flat list of the 20 most recent closed positions.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address')?.toLowerCase();

  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const [vaults, recentClosed] = await Promise.all([
    prisma.userVault.findMany({
      where:   { follower: address },
      include: { positions: { where: { status: 'OPEN' } } },
    }),
    prisma.position.findMany({
      where:   { follower: address, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take:    20,
    }),
  ]);

  // Fetch prices for all open-position tokens in one query
  const tokens = [...new Set(vaults.flatMap((v) => v.positions.map((p) => p.token)))];
  const priceRows = await prisma.tokenPrice.findMany({ where: { token: { in: tokens } } });
  const priceMap: Record<string, number> = {};
  for (const row of priceRows) priceMap[row.token] = Number(row.price);

  let totalLocked = 0;
  let totalPnl    = 0;
  let activeCount = 0;

  for (const vault of vaults) {
    totalLocked += Number(vault.ausdcLocked);
    if (vault.status === 'ACTIVE') activeCount++;
    for (const pos of vault.positions) {
      const current = priceMap[pos.token] ?? Number(pos.entryPrice);
      const entry   = Number(pos.entryPrice);
      if (entry > 0) {
        totalPnl += (Number(pos.ausdcAllocated) * current) / entry - Number(pos.ausdcAllocated);
      }
    }
  }

  const realizedPnl = recentClosed.reduce((sum, p) => sum + Number(p.pnl ?? 0), 0);

  return NextResponse.json({
    summary: {
      totalLocked:   +totalLocked.toFixed(6),
      unrealizedPnl: +totalPnl.toFixed(6),
      realizedPnl:   +realizedPnl.toFixed(6),
      activeVaults:  activeCount,
      totalVaults:   vaults.length,
    },
    recentClosed,
  });
}
