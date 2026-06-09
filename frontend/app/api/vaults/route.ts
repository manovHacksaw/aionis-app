import { NextResponse }      from 'next/server';
import { prisma }            from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

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
    // Granular trade filters (VaultManager v6) — USD fields use 0 as "no limit"
    slippageBps,
    minLeaderTradeUsd,
    maxLeaderTradeUsd,
    minAllocUsd,
    maxAllocUsd,
    stopLossPct,
  } = body;

  if (!follower || !leader || !ausdLocked || !riskLevel) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  const followerLower = follower.toLowerCase();
  const leaderLower   = leader.toLowerCase();
  const where         = { follower_leader: { follower: followerLower, leader: leaderLower } };

  const existed = await prisma.userVault.findUnique({ where });

  const limitFields = {
    slippageBps:       slippageBps       ?? 100,
    minLeaderTradeUsd: minLeaderTradeUsd ?? 0,
    maxLeaderTradeUsd: maxLeaderTradeUsd ?? 0,
    minAllocUsd:       minAllocUsd       ?? 0,
    maxAllocUsd:       maxAllocUsd       ?? 0,
    stopLossPct:       stopLossPct       ?? 20,
  };

  const vault = await prisma.userVault.upsert({
    where,
    update: {
      ausdcLocked:    ausdLocked,
      riskLevel,
      maxPerTradePct: maxPerTradePct ?? riskLevel * 10,
      allowlistJson:  allowlist ?? [],
      onChainVaultId,
      status:         'ACTIVE',
      ...limitFields,
    },
    create: {
      follower:       followerLower,
      leader:         leaderLower,
      ausdcLocked:    ausdLocked,
      riskLevel,
      maxPerTradePct: maxPerTradePct ?? riskLevel * 10,
      allowlistJson:  allowlist ?? [],
      onChainVaultId,
      ...limitFields,
    },
  });

  // Notify the leader the first time someone deploys an agent to copy them —
  // re-deposits/edits to an existing agent shouldn't re-notify.
  if (!existed) {
    const short = `${followerLower.slice(0, 6)}…${followerLower.slice(-4)}`;
    await createNotification({
      recipient: leaderLower,
      type:      'FOLLOW',
      actor:     followerLower,
      message:   `${short} started copying your trades`,
      metadata:  { ausdcLocked: ausdLocked, riskLevel },
      dedupeKey: `follow:${followerLower}:${leaderLower}`,
    }).catch((err) => console.error('[vaults API] Failed to create follow notification:', err));
  }

  return NextResponse.json(vault, { status: 201 });
}
