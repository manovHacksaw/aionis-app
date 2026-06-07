import { NextResponse }  from 'next/server';
import { prisma }        from '@/lib/prisma';
import { getWsomiPrice } from '@/lib/price';

// Stablecoins always return 1.0 — no lookup needed.
const STABLECOINS = new Set(['USDC', 'USDC.E', 'USDT', 'DAI', 'AUSD']);

// VaultManager.updatePrice() builds its fetch URL from the token's hex
// address (`_toHexString(token)`) — Solidity has no symbol lookup. Map the
// known pool tokens back to symbols so the existing symbol-keyed lookups below
// still work regardless of whether the caller passes an address or a symbol.
const ADDRESS_TO_SYMBOL: Record<string, string> = {
  '0x046ede9564a72571df6f5e44d0405360c0f4dcab': 'WSOMI',
  '0x28bec7e30e6faee657a03e19bf1128aad7632a00': 'USDC.e',
  '0xc063b29cd6b30885783b505ae180b3079e0a2154': 'NIA',
  '0x67b302e35aef5eee8c32d934f5856869ef428330': 'USDT',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const symbol = ADDRESS_TO_SYMBOL[rawToken.toLowerCase()] ?? rawToken;
  const token  = symbol.toUpperCase();

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
