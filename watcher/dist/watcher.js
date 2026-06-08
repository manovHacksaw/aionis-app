import { createPublicClient, webSocket, http } from 'viem';
import { ALGEBRA_SWAP_ABI } from './price.js';
import { parseSwapLog } from './parser.js';
import { processTrade } from './copy-engine.js';
import { callCheckLeaderActivity, getOpenPositionIdsForToken, callClosePosition, callUpdatePrice, waitForPrice, } from './keeper.js';
import { claimSwap } from './dedup.js';
import { somniaMainnet, POOLS } from './config.js';
function makeWsClient() {
    return createPublicClient({
        chain: somniaMainnet,
        transport: webSocket('wss://api.infra.mainnet.somnia.network/ws', {
            reconnect: { attempts: Infinity, delay: 2_000 },
        }),
    });
}
function makeHttpClient() {
    return createPublicClient({
        chain: somniaMainnet,
        transport: http('https://api.infra.mainnet.somnia.network/'),
    });
}
// Refreshed every 15s from DB — cheap queries (DISTINCT leader), and a fresh
// vault/follow should start being tracked within one human-perceptible beat.
let trackedLeaders = new Set();
async function refreshLeaders(db) {
    const [paperLeaders, onChainLeaders] = await Promise.all([
        db.getAllLeaders(),
        db.getAllOnChainLeaders(),
    ]);
    trackedLeaders = new Set([...paperLeaders, ...onChainLeaders].map((l) => l.toLowerCase()));
    console.log(`[watcher] Tracking ${trackedLeaders.size} leader(s) (${paperLeaders.length} paper + ${onChainLeaders.length} on-chain)`);
}
// Cached WSOMI price — updated whenever a WSOMI pool swap is seen
let wsomiPriceCache = 0;
export async function startWatcher(db) {
    await refreshLeaders(db);
    const refreshTimer = setInterval(() => refreshLeaders(db), 15 * 1000);
    const wsClient = makeWsClient();
    const httpClient = makeHttpClient();
    console.log(`[watcher] Subscribing to ${POOLS.length} pool(s) on Somnia Mainnet…`);
    POOLS.forEach((p) => console.log(`  ${p.token0.symbol}/${p.token1.symbol} ${p.address}`));
    // ── Per-pool handler ──────────────────────────────────────────────────────
    async function handleLog(log, pool) {
        const recipient = log.args.recipient.toLowerCase();
        const txHash = log.transactionHash ?? '0x';
        const recordClaimed = await claimSwap(`${txHash}:${pool.address}:rec`, recipient);
        if (!recordClaimed)
            return;
        const blockTime = await getBlockTime(httpClient, log.blockNumber ?? 0n);
        const intent = parseSwapLog({
            sender: log.args.sender,
            recipient: log.args.recipient,
            amount0: log.args.amount0,
            amount1: log.args.amount1,
            price: log.args.price,
            liquidity: log.args.liquidity,
            tick: log.args.tick,
            txHash: txHash,
            blockTime,
        }, pool, wsomiPriceCache);
        // Keep WSOMI price cache fresh
        if (intent.wsomiPrice > 0)
            wsomiPriceCache = intent.wsomiPrice;
        await db.recordLeaderSwap({
            leader: recipient,
            side: intent.side,
            tokenIn: intent.tokenIn,
            tokenOut: intent.tokenOut,
            usdValue: intent.usdValue,
            wsomiPrice: intent.wsomiPrice,
            txHash,
            timestamp: intent.timestamp,
        }).catch((e) => console.error('[watcher] recordLeaderSwap error:', e.message));
        console.log(`[${pool.token0.symbol}/${pool.token1.symbol}] ` +
            `${intent.side} ${recipient.slice(0, 8)}… ` +
            `$${intent.usdValue.toFixed(2)} @ wsomi=$${intent.wsomiPrice.toFixed(4)}`);
        if (trackedLeaders.has(recipient)) {
            const claimed = await claimSwap(`${txHash}:${pool.address}`, recipient);
            if (claimed) {
                // Paper trading (off-chain simulation)
                await processTrade(intent, db).catch((e) => console.error('[watcher] processTrade error:', e.message));
                // On-chain copy trading:
                //   BUY  → leader is acquiring tokenOut; open a new position if it's allowlisted
                //   SELL → leader is exiting tokenIn; only close positions the vault actually holds
                //          (mirrors the contract's documented intent: closePosition is
                //          "called by... the keeper wallet when the leader sells")
                db.getOnChainFollowers(recipient).then(async (vaults) => {
                    const tokenOut = intent.tokenOut.toLowerCase();
                    const tokenIn = intent.tokenIn.toLowerCase();
                    for (const { follower, allowlist } of vaults) {
                        if (intent.side === 'BUY') {
                            if (!allowlist.includes(tokenOut)) {
                                console.log(`[keeper] skip ${follower.slice(0, 8)}… — ${tokenOut.slice(0, 8)}… not in allowlist`);
                                continue;
                            }
                            callCheckLeaderActivity(follower, recipient).catch((e) => console.error(`[keeper] ${follower.slice(0, 8)}… → ${e.message}`));
                        }
                        else {
                            const openIds = await getOpenPositionIdsForToken(follower, recipient, tokenIn).catch((e) => {
                                console.error(`[keeper] ${follower.slice(0, 8)}… getOpenPositions → ${e.message}`);
                                return [];
                            });
                            if (openIds.length === 0) {
                                console.log(`[keeper] skip ${follower.slice(0, 8)}… — no open ${tokenIn.slice(0, 8)}… position to close`);
                                continue;
                            }
                            // closePosition requires a fresh on-chain price — refresh it and
                            // wait for the JSON API agent's callback before closing.
                            (async () => {
                                try {
                                    await callUpdatePrice(tokenIn);
                                    await waitForPrice(tokenIn);
                                }
                                catch (e) {
                                    console.error(`[keeper] ${follower.slice(0, 8)}… price refresh for ${tokenIn.slice(0, 8)}… failed: ${e.message}`);
                                    return;
                                }
                                for (const positionId of openIds) {
                                    callClosePosition(positionId).catch((e) => console.error(`[keeper] ${follower.slice(0, 8)}… closePosition → ${e.message}`));
                                }
                            })();
                        }
                    }
                }).catch((e) => console.error('[watcher] getOnChainFollowers error:', e.message));
            }
        }
    }
    // ── Primary: WebSocket subscriptions (one per pool) ───────────────────────
    const unwatchers = POOLS.map((pool) => wsClient.watchContractEvent({
        address: pool.address,
        abi: ALGEBRA_SWAP_ABI,
        eventName: 'Swap',
        onLogs: async (logs) => { for (const log of logs)
            await handleLog(log, pool); },
        onError: (e) => console.error(`[watcher:ws:${pool.token0.symbol}/${pool.token1.symbol}] ${e.message}`),
    }));
    // ── Fallback: HTTP polling every 12s ─────────────────────────────────────
    const lastBlocks = new Map(POOLS.map((p) => [p.address, 0n]));
    const pollTimer = setInterval(async () => {
        try {
            const latest = await httpClient.getBlockNumber();
            for (const pool of POOLS) {
                const lastBlock = lastBlocks.get(pool.address);
                if (lastBlock === 0n) {
                    lastBlocks.set(pool.address, latest - 1n);
                    continue;
                }
                if (latest <= lastBlock)
                    continue;
                const logs = await httpClient.getContractEvents({
                    address: pool.address,
                    abi: ALGEBRA_SWAP_ABI,
                    eventName: 'Swap',
                    fromBlock: lastBlock + 1n,
                    toBlock: latest,
                });
                for (const log of logs)
                    await handleLog(log, pool).catch(() => { });
                lastBlocks.set(pool.address, latest);
            }
        }
        catch (e) {
            console.error('[watcher:poll] error:', e.message);
        }
    }, 12_000);
    return () => {
        unwatchers.forEach((u) => u());
        clearInterval(pollTimer);
        clearInterval(refreshTimer);
    };
}
// ── Block time cache ──────────────────────────────────────────────────────────
const blockTimeCache = new Map();
async function getBlockTime(client, blockNumber) {
    if (blockTimeCache.has(blockNumber))
        return blockTimeCache.get(blockNumber);
    try {
        const block = await client.getBlock({ blockNumber });
        const ts = Number(block.timestamp);
        blockTimeCache.set(blockNumber, ts);
        if (blockTimeCache.size > 500)
            blockTimeCache.delete(blockTimeCache.keys().next().value);
        return ts;
    }
    catch {
        return Math.floor(Date.now() / 1000);
    }
}
