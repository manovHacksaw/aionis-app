import { NextResponse }  from 'next/server';
import { prisma }        from '@/lib/prisma';
import { getWsomiPrice } from '@/lib/price';

// Stablecoins always return 1.0 — no lookup needed.
const STABLECOINS = new Set(['USDC', 'USDC.E', 'USDT', 'DAI', 'AUSD']);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = rawToken.toUpperCase();

  if (STABLECOINS.has(token)) {
    return NextResponse.json({ token, price: '1.0', source: 'stable' });
  }

  // 1. Try DB first (watcher keeps this fresh)
  const row = await prisma.tokenPrice.findUnique({ where: { token } });

  if (row) {
    return NextResponse.json({
      token,
      price:     row.price.toString(),
      updatedAt: row.updatedAt,
      source:    'db',
    });
  }

  // 2. Fall back to live on-chain fetch for WSOMI
  if (token === 'WSOMI') {
    try {
      const price = await getWsomiPrice();
      return NextResponse.json({ token, price: price.toString(), source: 'live' });
    } catch {
      return NextResponse.json({ error: 'price unavailable' }, { status: 503 });
    }
  }

  return NextResponse.json({ error: `no price for ${token}` }, { status: 404 });
}
