import { createPublicClient, webSocket, http } from 'viem';
import { ALGEBRA_SWAP_ABI }           from './price.js';
import { parseSwapLog }               from './parser.js';
import { processTrade }               from './copy-engine.js';
import {
  callCheckLeaderActivity,
  getOpenPositionIdsForToken,
  callClosePosition,
  callUpdatePrice,
  waitForPrice,
} from './keeper.js';
import { claimSwap }                  from './dedup.js';
import { incrStat, STAT_EVALUATED }   from './stats.js';
import { somniaMainnet, POOLS, type PoolDef } from './config.js';
import { log, warn, error }           from './logger.js';
import type { Db }                    from './db.js';

function makeWsClient() {
  return createPublicClient({
    chain:     somniaMainnet,
    transport: webSocket('wss://api.infra.mainnet.somnia.network/ws', {
      reconnect: { attempts: Infinity, delay: 2_000 },
    }),
  });
}

function makeHttpClient() {
  return createPublicClient({
    chain:     somniaMainnet,
    transport: http('https://api.infra.mainnet.somnia.network/'),
  });
}

// Refreshed every 15s from DB — cheap queries (DISTINCT leader), and a fresh
// vault/follow should start being tracked within one human-perceptible beat.
let trackedLeaders = new Set<string>();

async function refreshLeaders(db: Db) {
  try {
    const [paperLeaders, onChainLeaders] = await Promise.all([
      db.getAllLeaders(),
      db.getAllOnChainLeaders(),
    ]);
    trackedLeaders = new Set([...paperLeaders, ...onChainLeaders].map((l) => l.toLowerCase()));
    log('watcher', `Tracking ${trackedLeaders.size} leader(s) — ${paperLeaders.length} paper + ${onChainLeaders.length} on-chain`);
    if (onChainLeaders.length > 0) {
      log('watcher', `On-chain leaders: ${onChainLeaders.map((l) => l.slice(0, 10) + '…').join(', ')}`);
    }
  } catch (e) {
    error('watcher', 'refreshLeaders DB query failed', e);
  }
}

// Cached WSOMI price — updated whenever a WSOMI pool swap is seen
let wsomiPriceCache = 0;

export async function startWatcher(db: Db): Promise<() => void> {
  await refreshLeaders(db);
  const refreshTimer = setInterval(() => refreshLeaders(db), 15 * 1000);

  const wsClient   = makeWsClient();
  const httpClient = makeHttpClient();

  log('watcher', `Subscribing to ${POOLS.length} pool(s) on Somnia Mainnet via WebSocket + HTTP fallback`);
  POOLS.forEach((p) => log('watcher', `  pool ${p.token0.symbol}/${p.token1.symbol} → ${p.address}`));

  // ── Per-pool handler ──────────────────────────────────────────────────────

  async function handleLog(rawLog: any, pool: PoolDef) {
    const recipient = (rawLog.args.recipient as string).toLowerCase();
    const txHash    = rawLog.transactionHash ?? '0x';
    const poolLabel = `${pool.token0.symbol}/${pool.token1.symbol}`;

    // Dedup at the record level — same tx can arrive via both WS and HTTP poll.
    const recordClaimed = await claimSwap(`${txHash}:${pool.address}:rec`, recipient);
    if (!recordClaimed) {
      log('watcher', `[${poolLabel}] dedup skip — already processed tx=${txHash.slice(0, 14)}… rec=${recipient.slice(0, 10)}…`);
      return;
    }

    const blockTime = await getBlockTime(httpClient, rawLog.blockNumber ?? 0n);
    const intent    = parseSwapLog(
      {
        sender:    rawLog.args.sender    as `0x${string}`,
        recipient: rawLog.args.recipient as `0x${string}`,
        amount0:   rawLog.args.amount0   as bigint,
        amount1:   rawLog.args.amount1   as bigint,
        price:     rawLog.args.price     as bigint,
        liquidity: rawLog.args.liquidity as bigint,
        tick:      rawLog.args.tick      as number,
        txHash:    txHash                as `0x${string}`,
        blockTime,
      },
      pool,
      wsomiPriceCache,
    );

    // Keep WSOMI price cache fresh
    if (intent.wsomiPrice > 0) wsomiPriceCache = intent.wsomiPrice;

    log('watcher', `[${poolLabel}] swap detected — ${intent.side} rec=${recipient.slice(0, 10)}… $${intent.usdValue.toFixed(2)} wsomi=$${intent.wsomiPrice.toFixed(6)} tx=${txHash.slice(0, 14)}… block=${rawLog.blockNumber}`);

    await db.recordLeaderSwap({
      leader:     recipient,
      side:       intent.side,
      tokenIn:    intent.tokenIn,
      tokenOut:   intent.tokenOut,
      usdValue:   intent.usdValue,
      wsomiPrice: intent.wsomiPrice,
      txHash,
      timestamp:  intent.timestamp,
    }).catch((e) => error('watcher', `recordLeaderSwap failed — tx=${txHash.slice(0, 14)}…`, e));

    if (!trackedLeaders.has(recipient)) {
      // Not a followed leader — recorded for leaderboard but no copy action needed.
      return;
    }

    log('watcher', `[${poolLabel}] TRACKED leader ${recipient.slice(0, 10)}… — triggering copy pipeline (${intent.side} $${intent.usdValue.toFixed(2)})`);
    incrStat(STAT_EVALUATED);

    const claimed = await claimSwap(`${txHash}:${pool.address}`, recipient);
    if (!claimed) {
      log('watcher', `[${poolLabel}] copy-pipeline dedup skip — already triggered for tx=${txHash.slice(0, 14)}… leader=${recipient.slice(0, 10)}…`);
      return;
    }

    // Paper trading (off-chain simulation)
    await processTrade(intent, db).catch((e) =>
      error('watcher', `processTrade failed — leader=${recipient.slice(0, 10)}…`, e)
    );

    // On-chain copy trading:
    //   BUY  → leader is acquiring tokenOut; open a new position if it's allowlisted
    //   SELL → leader is exiting tokenIn; only close positions the vault actually holds
    db.getOnChainFollowers(recipient).then(async (vaults) => {
      if (vaults.length === 0) {
        log('watcher', `no on-chain vaults for leader=${recipient.slice(0, 10)}… — nothing to copy on-chain`);
        return;
      }
      log('watcher', `on-chain copy: ${vaults.length} vault(s) to process for leader=${recipient.slice(0, 10)}… (${intent.side})`);

      const tokenOut = intent.tokenOut.toLowerCase();
      const tokenIn  = intent.tokenIn.toLowerCase();

      // BUY-side: latestPrice[tokenOut] is otherwise only refreshed during
      // SELL-side closes, so it drifts away from the leader's actual trade
      // price over time and trips the on-chain slippage guard for every BUY.
      // Refresh it once up front so _openPosition compares against a fresh price.
      if (intent.side === 'BUY') {
        try {
          await callUpdatePrice(tokenOut);
          await waitForPrice(tokenOut);
        } catch (e) {
          error('watcher', `price refresh failed for tokenOut=${tokenOut.slice(0, 10)}… leader=${recipient.slice(0, 10)}…`, e);
        }
      }

      for (const { follower, allowlist } of vaults) {
        if (intent.side === 'BUY') {
          if (!allowlist.includes(tokenOut)) {
            log('watcher', `keeper skip follower=${follower.slice(0, 10)}… — tokenOut=${tokenOut.slice(0, 10)}… not in allowlist [${allowlist.map((a) => a.slice(0, 8)).join(', ')}]`);
            continue;
          }
          log('watcher', `keeper dispatch checkLeaderActivity — follower=${follower.slice(0, 10)}… leader=${recipient.slice(0, 10)}…`);
          callCheckLeaderActivity(follower, recipient).catch((e) =>
            error('watcher', `checkLeaderActivity failed — follower=${follower.slice(0, 10)}… leader=${recipient.slice(0, 10)}…`, e)
          );
        } else {
          log('watcher', `keeper SELL: checking open positions for follower=${follower.slice(0, 10)}… tokenIn=${tokenIn.slice(0, 10)}…`);
          const openIds = await getOpenPositionIdsForToken(follower, recipient, tokenIn).catch((e) => {
            error('watcher', `getOpenPositionIdsForToken failed — follower=${follower.slice(0, 10)}… token=${tokenIn.slice(0, 10)}…`, e);
            return [] as `0x${string}`[];
          });
          if (openIds.length === 0) {
            log('watcher', `keeper skip follower=${follower.slice(0, 10)}… — no open ${tokenIn.slice(0, 10)}… position to close`);
            continue;
          }
          log('watcher', `keeper closing ${openIds.length} position(s) for follower=${follower.slice(0, 10)}… — refreshing on-chain price first`);

          // closePosition requires a fresh on-chain price — refresh and wait for callback.
          (async () => {
            try {
              await callUpdatePrice(tokenIn);
              await waitForPrice(tokenIn);
            } catch (e) {
              error('watcher', `price refresh failed for tokenIn=${tokenIn.slice(0, 10)}… follower=${follower.slice(0, 10)}…`, e);
              return;
            }
            log('watcher', `price refresh done — closing ${openIds.length} position(s) for follower=${follower.slice(0, 10)}…`);
            for (const positionId of openIds) {
              callClosePosition(positionId).catch((e) =>
                error('watcher', `closePosition failed — positionId=${positionId.slice(0, 18)}… follower=${follower.slice(0, 10)}…`, e)
              );
            }
          })();
        }
      }
    }).catch((e) => error('watcher', `getOnChainFollowers failed — leader=${recipient.slice(0, 10)}…`, e));
  }

  // ── Primary: WebSocket subscriptions (one per pool) ───────────────────────

  const unwatchers = POOLS.map((pool) => {
    const poolLabel = `${pool.token0.symbol}/${pool.token1.symbol}`;
    log('watcher', `WebSocket subscription active — pool ${poolLabel} ${pool.address}`);
    return wsClient.watchContractEvent({
      address:   pool.address,
      abi:       ALGEBRA_SWAP_ABI,
      eventName: 'Swap',
      onLogs:    async (logs) => {
        log('watcher', `[${poolLabel}] WS batch: ${logs.length} log(s)`);
        for (const l of logs) await handleLog(l, pool);
      },
      onError:   (e) => error('watcher', `WebSocket error on pool ${poolLabel}`, e),
    });
  });

  // ── Fallback: HTTP polling every 12s ─────────────────────────────────────

  const lastBlocks = new Map<string, bigint>(POOLS.map((p) => [p.address, 0n]));

  const pollTimer = setInterval(async () => {
    try {
      const latest = await httpClient.getBlockNumber();

      for (const pool of POOLS) {
        const poolLabel = `${pool.token0.symbol}/${pool.token1.symbol}`;
        const lastBlock = lastBlocks.get(pool.address)!;
        if (lastBlock === 0n) {
          lastBlocks.set(pool.address, latest - 1n);
          log('watcher', `[poll] ${poolLabel} initialised at block ${latest}`);
          continue;
        }
        if (latest <= lastBlock) continue;

        const from = lastBlock + 1n;
        const logs = await httpClient.getContractEvents({
          address:   pool.address,
          abi:       ALGEBRA_SWAP_ABI,
          eventName: 'Swap',
          fromBlock: from,
          toBlock:   latest,
        });

        if (logs.length > 0) {
          log('watcher', `[poll] ${poolLabel} blocks ${from}–${latest}: ${logs.length} swap(s)`);
        }
        for (const l of logs) await handleLog(l, pool).catch(() => {});
        lastBlocks.set(pool.address, latest);
      }
    } catch (e: any) {
      error('watcher', `HTTP poll cycle failed`, e);
    }
  }, 12_000);

  return () => {
    unwatchers.forEach((u) => u());
    clearInterval(pollTimer);
    clearInterval(refreshTimer);
  };
}

// ── Block time cache ──────────────────────────────────────────────────────────

const blockTimeCache = new Map<bigint, number>();

async function getBlockTime(client: ReturnType<typeof makeHttpClient>, blockNumber: bigint): Promise<number> {
  if (blockTimeCache.has(blockNumber)) return blockTimeCache.get(blockNumber)!;
  try {
    const block = await client.getBlock({ blockNumber });
    const ts    = Number(block.timestamp);
    blockTimeCache.set(blockNumber, ts);
    if (blockTimeCache.size > 500) blockTimeCache.delete(blockTimeCache.keys().next().value!);
    return ts;
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}
