import { PrismaClient }              from '@prisma/client';
import type { CopyModelKey, CopyModelConfig } from './copy-engine.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Vault {
  address:         `0x${string}`;
  virtualUsdc:     number;
  startingCapital: number;
  copyModelKey:    CopyModelKey;
  copyModelConfig: CopyModelConfig;
}

export interface PaperTrade {
  id:          string;
  follower:    `0x${string}`;
  leader:      `0x${string}`;
  side:        'BUY' | 'SELL';
  token:       string;
  usdcSpent:   number;
  tokenAmount: number;
  entryPrice:  number;
  exitPrice?:  number;
  pnl?:        number;
  status:      'OPEN' | 'CLOSED';
  txHash:      `0x${string}`;
  timestamp:   number;
}

export interface NewPaperTrade {
  follower:    `0x${string}`;
  leader:      `0x${string}`;
  side:        'BUY' | 'SELL';
  token:       string;
  usdcSpent:   number;
  tokenAmount: number;
  entryPrice:  number;
  txHash:      `0x${string}`;
  timestamp:   number;
}

export interface LeaderSwap {
  leader:     string;
  side:       'BUY' | 'SELL';
  tokenIn:    string;
  tokenOut:   string;
  usdValue:   number;
  wsomiPrice: number;
  txHash?:    string;
  timestamp:  number; // unix ms
}

export interface Db {
  getAllLeaders(): Promise<`0x${string}`[]>;
  getFollowers(leader: `0x${string}`): Promise<`0x${string}`[]>;
  getOnChainFollowers(leader: string): Promise<{ follower: string; allowlist: string[] }[]>;
  getAllOnChainLeaders(): Promise<string[]>;
  recordLeaderSwap(swap: LeaderSwap): Promise<void>;
  getLatestLeaderSwap(leader: string): Promise<LeaderSwap | null>;
  getVault(follower: `0x${string}`): Promise<Vault | null>;
  debitVirtualUsdc(follower: `0x${string}`, amount: number): Promise<void>;
  creditVirtualUsdc(follower: `0x${string}`, amount: number): Promise<void>;
  recordPaperTrade(trade: NewPaperTrade): Promise<string>;
  getOpenPosition(follower: `0x${string}`, leader: `0x${string}`, token: string): Promise<PaperTrade | null>;
  closePosition(id: string, exitPrice: number, pnl: number): Promise<void>;
  getAllOpenPositions(): Promise<PaperTrade[]>;
  upsertTokenPrice(token: string, price: number): Promise<void>;
  // ── On-chain position tracking (for frontend fast reads + stop-loss) ────
  getOpenOnChainPositions(): Promise<{
    onChainPositionId: string;
    follower: string;
    leader:   string;
    token:    string;
    ausdcAllocated: number;
    entryPrice:     number;
    stopLossPct:    number;
  }[]>;
  findVaultByOnChainId(onChainVaultId: string): Promise<{ id: string; follower: string; leader: string } | null>;
  upsertOnChainPosition(data: {
    onChainPositionId: string;
    follower:          string;
    leader:            string;
    vaultId:           string;
    token:             string;
    ausdcAllocated:    number;
    entryPrice:        number;
    status:            'OPEN';
    openedAt:          Date;
    txHashOpen?:       string;
    latencyMs?:        number;
  }): Promise<void>;
  closeOnChainPosition(data: {
    onChainPositionId: string;
    pnl:               number;
    exitPrice:         number;
    closedAt:          Date;
    txHashClose?:      string;
    closeReason?:      string;
  }): Promise<void>;
}

// ── Prisma singleton ──────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toVault(v: any): Vault {
  return {
    address:         v.address as `0x${string}`,
    virtualUsdc:     Number(v.virtualUsdc),
    startingCapital: Number(v.startingCapital),
    copyModelKey:    (v.copyModelKey ?? 'fixed_available_pct') as CopyModelKey,
    copyModelConfig: (v.copyModelConfig ?? {}) as CopyModelConfig,
  };
}

function toTrade(t: any): PaperTrade {
  return {
    id:          t.id,
    follower:    t.follower as `0x${string}`,
    leader:      t.leader  as `0x${string}`,
    side:        t.side    as 'BUY' | 'SELL',
    token:       t.token,
    usdcSpent:   Number(t.usdcSpent),
    tokenAmount: Number(t.tokenAmount),
    entryPrice:  Number(t.entryPrice),
    exitPrice:   t.exitPrice  ? Number(t.exitPrice)  : undefined,
    pnl:         t.pnl        ? Number(t.pnl)        : undefined,
    status:      t.status     as 'OPEN' | 'CLOSED',
    txHash:      (t.txHash ?? '0x') as `0x${string}`,
    timestamp:   new Date(t.timestamp).getTime(),
  };
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export function createPrismaDb(): Db {
  const prisma = getPrisma();

  return {
    async getAllLeaders() {
      const rows = await prisma.follow.findMany({
        select:  { leader: true },
        distinct: ['leader'],
      });
      return rows.map((r) => r.leader as `0x${string}`);
    },

    async getFollowers(leader) {
      const rows = await prisma.follow.findMany({
        where: { leader: leader.toLowerCase() },
        select: { follower: true },
      });
      return rows.map((r) => r.follower as `0x${string}`);
    },

    async getAllOnChainLeaders() {
      const rows = await prisma.userVault.findMany({
        where:  { status: 'ACTIVE' },
        select: { leader: true },
        distinct: ['leader'],
      });
      return rows.map((r) => r.leader);
    },

    async getOnChainFollowers(leader) {
      const rows = await prisma.userVault.findMany({
        where:  { leader: leader.toLowerCase(), status: 'ACTIVE' },
        select: { follower: true, allowlistJson: true },
      });
      return rows.map((r) => ({
        follower:  r.follower,
        allowlist: (r.allowlistJson as string[]).map((a) => a.toLowerCase()),
      }));
    },

    async recordLeaderSwap(swap) {
      await prisma.leaderSwap.create({
        data: {
          leader:     swap.leader.toLowerCase(),
          side:       swap.side,
          tokenIn:    swap.tokenIn,
          tokenOut:   swap.tokenOut,
          usdValue:   swap.usdValue,
          wsomiPrice: swap.wsomiPrice,
          txHash:     swap.txHash,
          timestamp:  new Date(swap.timestamp),
        },
      });
    },

    async getLatestLeaderSwap(leader) {
      const row = await prisma.leaderSwap.findFirst({
        where:   { leader: leader.toLowerCase() },
        orderBy: { timestamp: 'desc' },
      });
      if (!row) return null;
      return {
        leader:     row.leader,
        side:       row.side as 'BUY' | 'SELL',
        tokenIn:    row.tokenIn,
        tokenOut:   row.tokenOut,
        usdValue:   Number(row.usdValue),
        wsomiPrice: Number(row.wsomiPrice),
        txHash:     row.txHash ?? undefined,
        timestamp:  new Date(row.timestamp).getTime(),
      };
    },

    async getVault(follower) {
      const v = await prisma.vault.findUnique({
        where: { address: follower.toLowerCase() },
      });
      return v ? toVault(v) : null;
    },

    async debitVirtualUsdc(follower, amount) {
      await prisma.vault.update({
        where: { address: follower.toLowerCase() },
        data:  { virtualUsdc: { decrement: amount } },
      });
    },

    async creditVirtualUsdc(follower, amount) {
      await prisma.vault.update({
        where: { address: follower.toLowerCase() },
        data:  { virtualUsdc: { increment: amount } },
      });
    },

    async recordPaperTrade(t) {
      const record = await prisma.paperTrade.create({
        data: {
          follower:    t.follower.toLowerCase(),
          leader:      t.leader.toLowerCase(),
          side:        t.side,
          token:       t.token,
          usdcSpent:   t.usdcSpent,
          tokenAmount: t.tokenAmount,
          entryPrice:  t.entryPrice,
          status:      'OPEN',
          txHash:      t.txHash,
          timestamp:   new Date(t.timestamp),
        },
      });
      return record.id;
    },

    async getOpenPosition(follower, leader, token) {
      const t = await prisma.paperTrade.findFirst({
        where: {
          follower: follower.toLowerCase(),
          leader:   leader.toLowerCase(),
          token,
          status:   'OPEN',
        },
        orderBy: { timestamp: 'desc' },
      });
      return t ? toTrade(t) : null;
    },

    async closePosition(id, exitPrice, pnl) {
      await prisma.paperTrade.update({
        where: { id },
        data:  { exitPrice, pnl, status: 'CLOSED' },
      });
    },

    async getAllOpenPositions() {
      const rows = await prisma.paperTrade.findMany({
        where: { status: 'OPEN' },
      });
      return rows.map(toTrade);
    },

    async upsertTokenPrice(token, price) {
      await prisma.tokenPrice.upsert({
        where:  { token: token.toUpperCase() },
        update: { price },
        create: { token: token.toUpperCase(), price },
      });
    },

    async getOpenOnChainPositions() {
      const rows = await prisma.position.findMany({
        where:   { status: 'OPEN', onChainPositionId: { not: null } },
        include: { vault: { select: { stopLossPct: true } } },
      });
      return rows.map((r) => ({
        onChainPositionId: r.onChainPositionId!,
        follower:          r.follower,
        leader:            r.leader,
        token:             r.token,
        ausdcAllocated:    Number(r.ausdcAllocated),
        entryPrice:        Number(r.entryPrice),
        stopLossPct:       r.vault.stopLossPct,
      }));
    },

    async findVaultByOnChainId(onChainVaultId) {
      const row = await prisma.userVault.findFirst({
        where:  { onChainVaultId: onChainVaultId.toLowerCase() },
        select: { id: true, follower: true, leader: true },
      });
      return row ?? null;
    },

    async upsertOnChainPosition(data) {
      const existing = await prisma.position.findFirst({
        where: { onChainPositionId: data.onChainPositionId },
      });
      if (existing) return; // already recorded — don't overwrite open positions
      await prisma.position.create({
        data: {
          follower:          data.follower.toLowerCase(),
          leader:            data.leader.toLowerCase(),
          vaultId:           data.vaultId,
          token:             data.token,
          ausdcAllocated:    data.ausdcAllocated,
          entryPrice:        data.entryPrice,
          status:            'OPEN',
          onChainPositionId: data.onChainPositionId,
          openedAt:          data.openedAt,
          txHashOpen:        data.txHashOpen,
          latencyMs:         data.latencyMs,
        },
      });
    },

    async closeOnChainPosition(data) {
      await prisma.position.updateMany({
        where: { onChainPositionId: data.onChainPositionId, status: 'OPEN' },
        data:  {
          status:       'CLOSED',
          pnl:          data.pnl,
          exitPrice:    data.exitPrice,
          closedAt:     data.closedAt,
          txHashClose:  data.txHashClose,
          closeReason:  data.closeReason ?? null,
        },
      });
    },
  };
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) { await _prisma.$disconnect(); _prisma = null; }
}
