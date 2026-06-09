import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

// GET /api/activity/[follower]
// Returns the follower's agent timeline (opened/closed positions) and stats.
// Pure DB read — no RPC, no log scanning. Fast by design.

export type ActivityEvent = {
  id:            string;
  type:          'OPENED' | 'CLOSED';
  token:         string;
  ausdAllocated: number;
  entryPrice:    number;
  exitPrice:     number | null;
  pnl:           number | null;
  pnlPct:        number | null;
  leader:        string;
  happenedAt:    string;
  txHash:        string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ follower: string }> }
) {
  const { follower } = await params;
  const addr = follower.toLowerCase();

  const [recent, all] = await Promise.all([
    prisma.position.findMany({
      where:   { follower: addr },
      orderBy: { openedAt: 'desc' },
      take:    20,
    }),
    prisma.position.findMany({
      where:  { follower: addr },
      select: { status: true, pnl: true, openedAt: true },
    }),
  ]);

  const now       = new Date();
  const todayStr  = now.toDateString();
  const openCount    = all.filter(p => p.status === 'OPEN').length;
  const closedCount  = all.filter(p => p.status === 'CLOSED').length;
  const totalPnl     = all.reduce((sum, p) => sum + Number(p.pnl ?? 0), 0);
  const openedToday  = all.filter(p => new Date(p.openedAt).toDateString() === todayStr).length;

  const events: ActivityEvent[] = recent.flatMap((p): ActivityEvent[] => {
    const base = {
      id:            p.id,
      token:         p.token,
      ausdAllocated: Number(p.ausdcAllocated),
      entryPrice:    Number(p.entryPrice),
      leader:        p.leader,
    };

    if (p.status === 'CLOSED' && p.closedAt) {
      const pnlNum    = Number(p.pnl ?? 0);
      const allocated = Number(p.ausdcAllocated);
      return [{
        ...base,
        type:       'CLOSED',
        exitPrice:  p.exitPrice ? Number(p.exitPrice) : null,
        pnl:        pnlNum,
        pnlPct:     allocated > 0 ? (pnlNum / allocated) * 100 : null,
        happenedAt: p.closedAt.toISOString(),
        txHash:     p.txHashClose ?? null,
      }];
    }

    return [{
      ...base,
      type:       'OPENED',
      exitPrice:  null,
      pnl:        null,
      pnlPct:     null,
      happenedAt: p.openedAt.toISOString(),
      txHash:     p.txHashOpen ?? null,
    }];
  });

  // Re-sort after flatMap (closed positions interleave with open)
  events.sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime());

  return NextResponse.json({
    stats: { openCount, closedCount, totalPnl, openedToday },
    events: events.slice(0, 10),
  });
}
