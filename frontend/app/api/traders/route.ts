import { NextResponse }       from 'next/server';
import { prisma }             from '@/lib/prisma';
import { createPublicClient, http, defineChain } from 'viem';
import { Redis }              from '@upstash/redis';

// ── Chain ──────────────────────────────────────────────────────────────────

const somniaMainnet = defineChain({
  id: 5031,
  name: 'Somnia Mainnet',
  nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
  rpcUrls: { default: { http: ['https://api.infra.mainnet.somnia.network/'] } },
});

const POOL = '0xe5467Be8B8Db6B074904134E8C1a581F5565E2c3' as const;

const SWAP_ABI = [{
  anonymous: false,
  inputs: [
    { indexed: true,  name: 'sender',    type: 'address' },
    { indexed: true,  name: 'recipient', type: 'address' },
    { indexed: false, name: 'amount0',   type: 'int256'  },
    { indexed: false, name: 'amount1',   type: 'int256'  },
    { indexed: false, name: 'price',     type: 'uint160' },
    { indexed: false, name: 'liquidity', type: 'uint128' },
    { indexed: false, name: 'tick',      type: 'int24'   },
  ],
  name: 'Swap',
  type: 'event',
}] as const;

// ── Redis cache (10-min TTL) ───────────────────────────────────────────────

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_KEY = 'stellalpha:traders:v1';
const CACHE_TTL = 600; // seconds

// ── On-chain scan ──────────────────────────────────────────────────────────

async function scanTraders() {
  const client = createPublicClient({ chain: somniaMainnet, transport: http() });
  const latest = await client.getBlockNumber();
  // ~2 days of history at ~400ms/block
  const fromBlock = latest > 500_000n ? latest - 500_000n : 0n;
  const CHUNK = 900n;

  type Stats = { address: string; buys: number; sells: number; volumeUsdc: number };
  const map = new Map<string, Stats>();

  // Known router addresses to skip (they are intermediaries, not real traders)
  const SKIP = new Set([
    '0x1582f6f3d26658f7208a799be46e34b1f366ce44', // QuickSwap SwapRouter
  ]);

  for (let start = fromBlock; start < latest; start += CHUNK) {
    const end  = start + CHUNK - 1n < latest ? start + CHUNK - 1n : latest;
    const logs = await client.getContractEvents({
      address: POOL, abi: SWAP_ABI, eventName: 'Swap',
      fromBlock: start, toBlock: end,
    });

    for (const log of logs) {
      const recipient = (log.args.recipient as string).toLowerCase();
      if (SKIP.has(recipient)) continue;

      const amount1   = log.args.amount1 as bigint;
      const isBuy     = (log.args.amount0 as bigint) < 0n;
      const usdcValue = Math.abs(Number(amount1)) / 1e6;

      const s = map.get(recipient) ?? { address: recipient, buys: 0, sells: 0, volumeUsdc: 0 };
      map.set(recipient, {
        ...s,
        buys:       isBuy ? s.buys + 1 : s.buys,
        sells:      isBuy ? s.sells : s.sells + 1,
        volumeUsdc: s.volumeUsdc + usdcValue,
      });
    }
  }

  return [...map.values()]
    .map((s) => ({ ...s, totalTrades: s.buys + s.sells }))
    .sort((a, b) => b.volumeUsdc - a.volumeUsdc);
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET() {
  // 1. Try Redis cache first
  const cached = await redis.get<any[]>(CACHE_KEY);
  let onChainTraders = cached ?? null;

  if (!onChainTraders) {
    onChainTraders = await scanTraders();
    await redis.set(CACHE_KEY, onChainTraders, { ex: CACHE_TTL });
  }

  // 2. Enrich with DB stats (paper-trade P&L, follower counts)
  const addresses = onChainTraders.map((t) => t.address);

  const [followerCounts, tradeStats] = await Promise.all([
    prisma.follow.groupBy({
      by:    ['leader'],
      where: { leader: { in: addresses } },
      _count: { follower: true },
    }),
    prisma.paperTrade.groupBy({
      by:    ['leader'],
      where: { leader: { in: addresses }, status: 'CLOSED' },
      _count: { id: true },
      _sum:   { pnl: true },
    }),
  ]);

  const followerMap = new Map(followerCounts.map((r) => [r.leader, r._count.follower]));
  const statsMap    = new Map(tradeStats.map((r) => [r.leader, r]));

  const data = onChainTraders.map((t) => ({
    address:       t.address,
    buys:          t.buys,
    sells:         t.sells,
    totalTrades:   t.totalTrades,
    volumeUsdc:    t.volumeUsdc,
    followerCount: followerMap.get(t.address) ?? 0,
    copyTradeCount: statsMap.get(t.address)?._count.id ?? 0,
    totalPnl:      Number(statsMap.get(t.address)?._sum.pnl ?? 0),
  }));

  return NextResponse.json(data);
}
