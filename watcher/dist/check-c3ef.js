import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('=== User Vaults ===');
    const vaults = await prisma.userVault.findMany({
        where: { leader: '0xc3ef32972c265a82efef46097dff1289cbdee72e' }
    });
    console.log(JSON.stringify(vaults, null, 2));
    console.log('\n=== Leader Swaps for 0xC3ef ===');
    const swaps = await prisma.leaderSwap.findMany({
        where: { leader: '0xc3ef32972c265a82efef46097dff1289cbdee72e' },
        orderBy: { timestamp: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(swaps, null, 2));
    console.log('\n=== Paper Trades for 0xC3ef ===');
    const paper = await prisma.paperTrade.findMany({
        where: { leader: '0xc3ef32972c265a82efef46097dff1289cbdee72e' },
        orderBy: { timestamp: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(paper, null, 2));
    console.log('\n=== Positions for 0xC3ef ===');
    const positions = await prisma.position.findMany({
        where: { leader: '0xc3ef32972c265a82efef46097dff1289cbdee72e' },
        orderBy: { openedAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(positions, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
