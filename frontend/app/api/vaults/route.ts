import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

// POST /api/vaults
// Called by the frontend after the on-chain createVault() tx confirms.
// Persists the vault to DB so the portfolio page doesn't need contract reads.
export async function POST(req: Request) {
  const body = await req.json();
  const {
    follower,
    leader,
    ausdLocked,
    riskLevel,
    maxPerTradePct,
    allowlist,        // string[]
    onChainVaultId,   // bytes32 hex string from the contract
  } = body;

  if (!follower || !leader || !ausdLocked || !riskLevel) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  const vault = await prisma.userVault.upsert({
    where:  { follower_leader: { follower: follower.toLowerCase(), leader: leader.toLowerCase() } },
    update: {
      ausdcLocked:    ausdLocked,
      riskLevel,
      maxPerTradePct: maxPerTradePct ?? riskLevel * 10,
      allowlistJson:  allowlist ?? [],
      onChainVaultId,
      status:         'ACTIVE',
    },
    create: {
      follower:       follower.toLowerCase(),
      leader:         leader.toLowerCase(),
      ausdcLocked:    ausdLocked,
      riskLevel,
      maxPerTradePct: maxPerTradePct ?? riskLevel * 10,
      allowlistJson:  allowlist ?? [],
      onChainVaultId,
    },
  });

  return NextResponse.json(vault, { status: 201 });
}
