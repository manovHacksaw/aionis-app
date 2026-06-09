import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import { redis }        from '@/lib/redis';

const CACHE_KEY = 'aionis:platform:stats';
const CACHE_TTL = 60; // 60s

// GET /api/stats — platform-wide aggregate metrics, no auth required
export async function GET() {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const [vaultStats, totalPositions, openPositions] = await Promise.all([
    prisma.userVault.aggregate({
      where:  { status: 'ACTIVE' },
      _count: { _all: true },
      _sum:   { ausdcLocked: true },
    }),
    prisma.position.count(),
    prisma.position.count({ where: { status: 'OPEN' } }),
  ]);

  const result = {
    activeAgents:   vaultStats._count._all,
    ausdLocked:     Number(vaultStats._sum.ausdcLocked ?? 0),
    totalPositions,
    openPositions,
  };

  await redis.set(CACHE_KEY, result, { ex: CACHE_TTL });
  return NextResponse.json(result);
}
