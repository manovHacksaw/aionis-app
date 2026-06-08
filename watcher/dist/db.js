import { PrismaClient } from '@prisma/client';
// ── Prisma singleton ──────────────────────────────────────────────────────────
let _prisma = null;
function getPrisma() {
    if (!_prisma)
        _prisma = new PrismaClient();
    return _prisma;
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function toVault(v) {
    return {
        address: v.address,
        virtualUsdc: Number(v.virtualUsdc),
        startingCapital: Number(v.startingCapital),
        copyModelKey: (v.copyModelKey ?? 'fixed_available_pct'),
        copyModelConfig: (v.copyModelConfig ?? {}),
    };
}
function toTrade(t) {
    return {
        id: t.id,
        follower: t.follower,
        leader: t.leader,
        side: t.side,
        token: t.token,
        usdcSpent: Number(t.usdcSpent),
        tokenAmount: Number(t.tokenAmount),
        entryPrice: Number(t.entryPrice),
        exitPrice: t.exitPrice ? Number(t.exitPrice) : undefined,
        pnl: t.pnl ? Number(t.pnl) : undefined,
        status: t.status,
        txHash: (t.txHash ?? '0x'),
        timestamp: new Date(t.timestamp).getTime(),
    };
}
// ── Prisma implementation ─────────────────────────────────────────────────────
export function createPrismaDb() {
    const prisma = getPrisma();
    return {
        async getAllLeaders() {
            const rows = await prisma.follow.findMany({
                select: { leader: true },
                distinct: ['leader'],
            });
            return rows.map((r) => r.leader);
        },
        async getFollowers(leader) {
            const rows = await prisma.follow.findMany({
                where: { leader: leader.toLowerCase() },
                select: { follower: true },
            });
            return rows.map((r) => r.follower);
        },
        async getAllOnChainLeaders() {
            const rows = await prisma.userVault.findMany({
                where: { status: 'ACTIVE' },
                select: { leader: true },
                distinct: ['leader'],
            });
            return rows.map((r) => r.leader);
        },
        async getOnChainFollowers(leader) {
            const rows = await prisma.userVault.findMany({
                where: { leader: leader.toLowerCase(), status: 'ACTIVE' },
                select: { follower: true, allowlistJson: true },
            });
            return rows.map((r) => ({
                follower: r.follower,
                allowlist: r.allowlistJson.map((a) => a.toLowerCase()),
            }));
        },
        async recordLeaderSwap(swap) {
            await prisma.leaderSwap.create({
                data: {
                    leader: swap.leader.toLowerCase(),
                    side: swap.side,
                    tokenIn: swap.tokenIn,
                    tokenOut: swap.tokenOut,
                    usdValue: swap.usdValue,
                    wsomiPrice: swap.wsomiPrice,
                    txHash: swap.txHash,
                    timestamp: new Date(swap.timestamp),
                },
            });
        },
        async getLatestLeaderSwap(leader) {
            const row = await prisma.leaderSwap.findFirst({
                where: { leader: leader.toLowerCase() },
                orderBy: { timestamp: 'desc' },
            });
            if (!row)
                return null;
            return {
                leader: row.leader,
                side: row.side,
                tokenIn: row.tokenIn,
                tokenOut: row.tokenOut,
                usdValue: Number(row.usdValue),
                wsomiPrice: Number(row.wsomiPrice),
                txHash: row.txHash ?? undefined,
                timestamp: new Date(row.timestamp).getTime(),
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
                data: { virtualUsdc: { decrement: amount } },
            });
        },
        async creditVirtualUsdc(follower, amount) {
            await prisma.vault.update({
                where: { address: follower.toLowerCase() },
                data: { virtualUsdc: { increment: amount } },
            });
        },
        async recordPaperTrade(t) {
            const record = await prisma.paperTrade.create({
                data: {
                    follower: t.follower.toLowerCase(),
                    leader: t.leader.toLowerCase(),
                    side: t.side,
                    token: t.token,
                    usdcSpent: t.usdcSpent,
                    tokenAmount: t.tokenAmount,
                    entryPrice: t.entryPrice,
                    status: 'OPEN',
                    txHash: t.txHash,
                    timestamp: new Date(t.timestamp),
                },
            });
            return record.id;
        },
        async getOpenPosition(follower, leader, token) {
            const t = await prisma.paperTrade.findFirst({
                where: {
                    follower: follower.toLowerCase(),
                    leader: leader.toLowerCase(),
                    token,
                    status: 'OPEN',
                },
                orderBy: { timestamp: 'desc' },
            });
            return t ? toTrade(t) : null;
        },
        async closePosition(id, exitPrice, pnl) {
            await prisma.paperTrade.update({
                where: { id },
                data: { exitPrice, pnl, status: 'CLOSED' },
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
                where: { token: token.toUpperCase() },
                update: { price },
                create: { token: token.toUpperCase(), price },
            });
        },
    };
}
export async function disconnectPrisma() {
    if (_prisma) {
        await _prisma.$disconnect();
        _prisma = null;
    }
}
