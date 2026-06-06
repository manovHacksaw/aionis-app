import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

// GET /api/vaults/[address]
// Returns all UserVaults for a follower address, with open positions
// and per-position unrealized P&L calculated from TokenPrice table.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const follower = address.toLowerCase();

  const vaults = await prisma.userVault.findMany({
    where:   { follower },
    include: { positions: { where: { status: 'OPEN' } } },
    orderBy: { createdAt: 'desc' },
  });

  if (vaults.length === 0) {
    return NextResponse.json({ vaults: [], summary: { totalLocked: 0, totalPnl: 0, activeCount: 0 } });
  }

  // Collect all tokens needed for P&L so we do one query
  const tokens = [...new Set(vaults.flatMap((v) => v.positions.map((p) => p.token)))];
  const priceRows = await prisma.tokenPrice.findMany({ where: { token: { in: tokens } } });
  const priceMap: Record<string, number> = {};
  for (const row of priceRows) priceMap[row.token] = Number(row.price);

  let totalLocked = 0;
  let totalPnl    = 0;
  let activeCount = 0;

  const enrichedVaults = vaults.map((vault) => {
    const locked = Number(vault.ausdcLocked);
    totalLocked += locked;
    if (vault.status === 'ACTIVE') activeCount++;

    const positions = vault.positions.map((pos) => {
      const currentPrice = priceMap[pos.token] ?? Number(pos.entryPrice);
      const entryPrice   = Number(pos.entryPrice);
      const allocated    = Number(pos.ausdcAllocated);
      const unrealizedPnl = entryPrice > 0
        ? (allocated * currentPrice) / entryPrice - allocated
        : 0;
      return { ...pos, unrealizedPnl: +unrealizedPnl.toFixed(6) };
    });

    const vaultPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    totalPnl += vaultPnl;

    return {
      ...vault,
      ausdcLocked: locked,
      positions,
      unrealizedPnl: +vaultPnl.toFixed(6),
    };
  });

  return NextResponse.json({
    vaults: enrichedVaults,
    summary: {
      totalLocked: +totalLocked.toFixed(6),
      totalPnl:    +totalPnl.toFixed(6),
      activeCount,
    },
  });
}
