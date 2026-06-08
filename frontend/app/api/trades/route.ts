import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import { createPublicClient, http, keccak256, encodePacked, parseAbiItem } from 'viem';
import { somniaTestnet } from '@/config/chains';
import { getWsomiPrice } from '@/lib/price';

const VAULT_MANAGER = (process.env.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS ?? '') as `0x${string}`;

// Block the current VaultManager (v6) was deployed at — pipeline events
// can't exist before this, so there's no need to scan further back.
const DEPLOY_BLOCK = 403_597_497n;

const EVENTS = [
  parseAbiItem('event WatcherRequested(uint256 indexed requestId, bytes32 indexed vaultId)'),
  parseAbiItem('event WatcherResponse(uint256 indexed requestId, bytes32 indexed vaultId, address tokenOut, uint256 usdValue, uint256 tradeTimestamp)'),
  parseAbiItem('event StrategistResponse(uint256 indexed requestId, bytes32 indexed vaultId, uint8 score, bool willExecute)'),
  parseAbiItem('event TradeSkipped(bytes32 indexed vaultId, string reason)'),
  parseAbiItem('event PositionOpened(bytes32 indexed positionId, bytes32 indexed vaultId, address token, uint256 ausdAllocated, uint256 entryPrice)'),
  parseAbiItem('event PositionClosed(bytes32 indexed positionId, bytes32 indexed vaultId, int256 pnl, uint256 exitPrice)'),
] as const;

const client = createPublicClient({ chain: somniaTestnet, transport: http() });

const ADDRESS_TO_SYMBOL: Record<string, string> = {
  '0x046ede9564a72571df6f5e44d0405360c0f4dcab': 'WSOMI',
  '0x28bec7e30e6faee657a03e19bf1128aad7632a00': 'USDC',
  '0xc063b29cd6b30885783b505ae180b3079e0a2154': 'NIA',
  '0x67b302e35aef5eee8c32d934f5856869ef428330': 'USDT',
};

const symbolFor = (addr: string) =>
  ADDRESS_TO_SYMBOL[addr.toLowerCase()] ?? `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const vaultIdFor = (follower: `0x${string}`, leader: `0x${string}`) =>
  keccak256(encodePacked(['address', 'address'], [follower, leader]));

const globalForLogs = globalThis as unknown as {
  globalLogs: any[];
  lastSyncedBlock: bigint;
  activeSyncPromise: Promise<void> | null;
  blockTimeCache: Map<bigint, number>;
};

if (!globalForLogs.globalLogs) {
  globalForLogs.globalLogs = [];
  globalForLogs.lastSyncedBlock = DEPLOY_BLOCK;
  globalForLogs.activeSyncPromise = null;
  globalForLogs.blockTimeCache = new Map<bigint, number>();
}

async function getBlockTime(blockNumber: bigint): Promise<number> {
  if (globalForLogs.blockTimeCache.has(blockNumber)) return globalForLogs.blockTimeCache.get(blockNumber)!;
  try {
    const block = await client.getBlock({ blockNumber });
    const ts    = Number(block.timestamp);
    globalForLogs.blockTimeCache.set(blockNumber, ts);
    return ts;
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

async function getLivePrice(tokenAddress: string, wsomiPrice: number): Promise<number> {
  const symbol = ADDRESS_TO_SYMBOL[tokenAddress.toLowerCase()];
  if (!symbol) return 0;
  if (symbol === 'WSOMI') return wsomiPrice;
  if (symbol === 'USDC' || symbol === 'USDT') return 1.0;
  if (symbol === 'NIA') {
    try {
      const stateNia = await client.readContract({
        address: '0x89B6827843B884B862489C2Fc526374D0F9F1c39' as `0x${string}`,
        abi: [{
          inputs: [],
          name: 'globalState',
          outputs: [{ name: 'price', type: 'uint160' }],
          stateMutability: 'view',
          type: 'function',
        }],
        functionName: 'globalState',
      });
      const rawNia = Number(stateNia as bigint) / 2 ** 96;
      return 1e12 / (rawNia * rawNia);
    } catch {
      return 0.005;
    }
  }
  return 0;
}

async function syncGlobalLogs() {
  if (!VAULT_MANAGER) return;

  if (globalForLogs.activeSyncPromise) {
    await globalForLogs.activeSyncPromise;
    return;
  }

  globalForLogs.activeSyncPromise = (async () => {
    try {
      const latest = await client.getBlockNumber();
      if (latest <= globalForLogs.lastSyncedBlock) {
        return;
      }

      console.log(`[trades-sync] Syncing logs from ${globalForLogs.lastSyncedBlock} to ${latest}…`);

      let newLogs: any[] = [];
      for (let from = globalForLogs.lastSyncedBlock; from <= latest; from += 1000n) {
        const to = from + 999n > latest ? latest : from + 999n;
        const chunk = await client.getLogs({
          address: VAULT_MANAGER,
          events: EVENTS,
          fromBlock: from,
          toBlock: to,
        });
        newLogs = newLogs.concat(chunk);
      }

      globalForLogs.globalLogs = globalForLogs.globalLogs.concat(newLogs);
      globalForLogs.lastSyncedBlock = latest;
      console.log(`[trades-sync] Sync completed. Total global logs: ${globalForLogs.globalLogs.length}`);
    } catch (err) {
      console.error('[trades-sync] Error during global log sync:', err);
    } finally {
      globalForLogs.activeSyncPromise = null;
    }
  })();

  await globalForLogs.activeSyncPromise;
}

// GET /api/trades?address=0x...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address')?.toLowerCase();

  console.log(`[trades-api] GET called for address: ${address}`);

  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 });
  }

  await syncGlobalLogs();

  // Find all user vaults in the database
  const vaults = await prisma.userVault.findMany({
    where: { follower: address },
  });

  console.log(`[trades-api] Found ${vaults.length} vaults for follower: ${address}`);

  if (vaults.length === 0) {
    return NextResponse.json({ trades: [] });
  }

  // Set of lowercase vaultIds for this follower
  const vaultIds = new Set(
    vaults.map((v) =>
      vaultIdFor(address as `0x${string}`, v.leader.toLowerCase() as `0x${string}`).toLowerCase()
    )
  );

  // Map of vaultId to leader address
  const vaultIdToLeader: Record<string, string> = {};
  for (const v of vaults) {
    const vId = vaultIdFor(address as `0x${string}`, v.leader.toLowerCase() as `0x${string}`).toLowerCase();
    vaultIdToLeader[vId] = v.leader;
  }

  // Filter global logs for relevant vaultIds
  const relevant = globalForLogs.globalLogs.filter((log) => {
    const vId = (log.args as { vaultId?: string }).vaultId?.toLowerCase();
    return vId && vaultIds.has(vId);
  });

  let wsomiPrice = 0.114;
  try {
    wsomiPrice = await getWsomiPrice();
  } catch (err) {
    console.error('Failed to get WSOMI price', err);
  }

  const allTrades: any[] = [];
  const positionMap = new Map<string, any>();

  // Process logs per vault to ensure strict sequential parsing
  for (const vId of Array.from(vaultIds)) {
    const leader = vaultIdToLeader[vId];
    const vaultLogs = relevant.filter(
      (log) => (log.args as { vaultId?: string }).vaultId?.toLowerCase() === vId
    );

    // Sort logs sequentially
    vaultLogs.sort((a, b) =>
      a.blockNumber !== b.blockNumber
        ? Number(a.blockNumber! - b.blockNumber!)
        : a.logIndex! - b.logIndex!
    );

    let currentAttempt: any = null;

    for (const log of vaultLogs) {
      const args = log.args as any;
      const txHash = log.transactionHash;

      switch (log.eventName) {
        case 'WatcherRequested':
          currentAttempt = {
            id: args.requestId.toString(),
            leader,
            token: 'WSOMI', // Default fallback
            ausdcAllocated: 0,
            entryPrice: 0,
            exitPrice: null,
            pnl: 0,
            pnlPct: 0,
            status: 'PENDING',
            reason: null,
            openedAt: null,
            closedAt: null,
            txHashOpen: txHash,
            txHashClose: null,
          };
          const tsOpen = await getBlockTime(log.blockNumber!);
          currentAttempt.openedAt = new Date(tsOpen * 1000).toISOString();
          allTrades.push(currentAttempt);
          break;

        case 'WatcherResponse':
          if (currentAttempt) {
            currentAttempt.token = symbolFor(args.tokenOut);
          }
          break;

        case 'TradeSkipped':
          if (currentAttempt && currentAttempt.status === 'PENDING') {
            currentAttempt.status = 'SKIPPED';
            currentAttempt.reason = args.reason;
            currentAttempt.txHashOpen = txHash; // Point to final resolving tx
            currentAttempt = null;
          }
          break;

        case 'PositionOpened':
          const posId = args.positionId.toLowerCase();
          const posAllocated = Number(args.ausdAllocated) / 1e6;
          const posEntry = Number(args.entryPrice) / 1e10;
          const posToken = symbolFor(args.token);
          const blockTimeOpen = await getBlockTime(log.blockNumber!);

          if (currentAttempt && currentAttempt.status === 'PENDING') {
            currentAttempt.status = 'OPEN';
            currentAttempt.token = posToken;
            currentAttempt.ausdcAllocated = posAllocated;
            currentAttempt.entryPrice = posEntry;
            currentAttempt.txHashOpen = txHash;
            currentAttempt.openedAt = new Date(blockTimeOpen * 1000).toISOString();
            
            positionMap.set(posId, currentAttempt);
            currentAttempt = null;
          } else {
            const posAttempt = {
              id: posId,
              leader,
              token: posToken,
              ausdcAllocated: posAllocated,
              entryPrice: posEntry,
              exitPrice: null,
              pnl: 0,
              pnlPct: 0,
              status: 'OPEN',
              reason: null,
              openedAt: new Date(blockTimeOpen * 1000).toISOString(),
              closedAt: null,
              txHashOpen: txHash,
              txHashClose: null,
            };
            allTrades.push(posAttempt);
            positionMap.set(posId, posAttempt);
          }
          break;

        case 'PositionClosed':
          const closedPosId = args.positionId.toLowerCase();
          const posClosed = positionMap.get(closedPosId);
          const blockTimeClose = await getBlockTime(log.blockNumber!);

          if (posClosed) {
            posClosed.status = 'CLOSED';
            posClosed.pnl = Number(args.pnl) / 1e6;
            posClosed.exitPrice = Number(args.exitPrice) / 1e10;
            posClosed.closedAt = new Date(blockTimeClose * 1000).toISOString();
            posClosed.txHashClose = txHash;
          } else {
            const closedPos = {
              id: closedPosId,
              leader,
              token: 'WSOMI', // Default fallback
              ausdcAllocated: 0,
              entryPrice: 0,
              exitPrice: Number(args.exitPrice) / 1e10,
              pnl: Number(args.pnl) / 1e6,
              pnlPct: 0,
              status: 'CLOSED',
              reason: null,
              openedAt: new Date(blockTimeClose * 1000).toISOString(),
              closedAt: new Date(blockTimeClose * 1000).toISOString(),
              txHashOpen: null,
              txHashClose: txHash,
            };
            allTrades.push(closedPos);
            positionMap.set(closedPosId, closedPos);
          }
          break;
      }
    }
  }

  // Filter out only pending attempts — keep OPEN, CLOSED, and SKIPPED
  const filteredTrades = allTrades.filter(t => t.status !== 'PENDING');

  // Enrich open trades with live P&L
  const enriched = await Promise.all(
    filteredTrades.map(async (trade) => {
      if (trade.status === 'OPEN') {
        const entryPrice = Number(trade.entryPrice);
        const ausdcAllocated = Number(trade.ausdcAllocated);
        const tokenAddr = Object.keys(ADDRESS_TO_SYMBOL).find(
          (key) => ADDRESS_TO_SYMBOL[key] === trade.token
        );
        const currentPrice = tokenAddr ? await getLivePrice(tokenAddr, wsomiPrice) : wsomiPrice;
        const pnl = entryPrice > 0 ? (ausdcAllocated * currentPrice) / entryPrice - ausdcAllocated : 0;
        const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

        return {
          ...trade,
          pnl: +pnl.toFixed(6),
          pnlPct: +pnlPct.toFixed(2),
        };
      } else if (trade.status === 'CLOSED') {
        const entryPrice = Number(trade.entryPrice);
        const exitPrice = Number(trade.exitPrice);
        const pnlPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
        return {
          ...trade,
          pnlPct: +pnlPct.toFixed(2),
        };
      }
      return trade;
    })
  );

  // Sort all trades by openedAt desc
  enriched.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  return NextResponse.json({ trades: enriched });
}
