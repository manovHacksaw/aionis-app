import { getCurrentWsomiPrice, getCurrentNiaPrice } from './price.js';
import { callUpdatePrice, waitForPrice, callClosePosition } from './keeper.js';
import { log, warn, error } from './logger.js';
import { markStopLoss } from './stop-loss-registry.js';
import type { Db } from './db.js';

// Global fallback (env STOP_LOSS_PCT) used only for startup log; actual threshold is per-vault
const DEFAULT_STOP_LOSS_PCT = Number(process.env.STOP_LOSS_PCT ?? '20');

// On-chain token addresses (VaultManager uses these as price-oracle keys)
const TOKEN_ADDRESS: Record<string, `0x${string}`> = {
  WSOMI: '0x046ede9564a72571df6f5e44d0405360c0f4dcab',
  NIA:   '0xc063b29cd6b30885783b505ae180b3079e0a2154',
};

// Prevent duplicate concurrent closes for the same position
const closingSet = new Set<string>();

async function triggerStopLoss(
  positionId: string,
  token:      string,
  follower:   string,
  pct:        number
): Promise<void> {
  const tokenAddr = TOKEN_ADDRESS[token];
  if (!tokenAddr) {
    error('pnl', `stop-loss: no token address mapping for ${token} — cannot close posId=${positionId.slice(0, 10)}…`);
    return;
  }

  warn('pnl', `STOP-LOSS triggered — follower=${follower.slice(0, 10)}…  token=${token}  drawdown=${(pct * 100).toFixed(1)}%  posId=${positionId.slice(0, 10)}…`);

  try {
    log('pnl', `stop-loss: refreshing on-chain price for ${token}…`);
    await callUpdatePrice(tokenAddr);
    await waitForPrice(tokenAddr);
    log('pnl', `stop-loss: price confirmed — closing posId=${positionId.slice(0, 10)}…`);
    // Register before the tx so vault-listener stamps STOP_LOSS when it sees PositionClosed
    markStopLoss(positionId);
    await callClosePosition(positionId as `0x${string}`);
    log('pnl', `stop-loss: position closed ✓  posId=${positionId.slice(0, 10)}…`);
  } finally {
    closingSet.delete(positionId);
  }
}

/** Polls open on-chain positions every 60s, updates token prices in DB,
 *  and triggers stop-loss auto-close when drawdown exceeds STOP_LOSS_PCT. */
export function startPnlUpdater(db: Db): () => void {
  log('pnl', `P&L updater started (60s interval, stop-loss: per-vault (env default: ${DEFAULT_STOP_LOSS_PCT}%))`);

  const timer = setInterval(async () => {
    try {
      // Fetch prices for all volatile tokens in one pass
      const [wsomiPrice, onChainPositions] = await Promise.all([
        getCurrentWsomiPrice(),
        db.getOpenOnChainPositions(),
      ]);
      log('pnl', `WSOMI price: $${wsomiPrice.toFixed(6)}`);
      await db.upsertTokenPrice('WSOMI', wsomiPrice);

      // Fetch NIA price only if there are NIA positions open
      let niaPrice: number | null = null;
      if (onChainPositions.some((p) => p.token === 'NIA')) {
        niaPrice = await getCurrentNiaPrice().catch(() => null);
        if (niaPrice != null) {
          log('pnl', `NIA price: $${niaPrice.toFixed(6)}`);
          await db.upsertTokenPrice('NIA', niaPrice);
        }
      }

      const priceOf = (token: string): number | null => {
        if (token === 'WSOMI') return wsomiPrice;
        if (token === 'USDC' || token === 'USDT') return 1.0;
        if (token === 'NIA') return niaPrice;
        return null;
      };

      // ── Legacy paper-trade P&L logging (unchanged) ────────────────────────
      const paperPositions = await db.getAllOpenPositions();
      if (paperPositions.length > 0) {
        log('pnl', `paper positions: ${paperPositions.length}`);
        for (const pos of paperPositions) {
          const price = priceOf(pos.token) ?? wsomiPrice;
          const pct   = (price - pos.entryPrice) / pos.entryPrice;
          const pnl   = pos.usdcSpent * pct;
          const sign  = pnl >= 0 ? '+' : '';
          log('pnl', `[paper] follower=${pos.follower.slice(0, 10)}… ${pos.token}  entry=$${pos.entryPrice.toFixed(6)}  now=$${price.toFixed(6)}  unrealised=${sign}$${pnl.toFixed(4)} (${sign}${(pct * 100).toFixed(2)}%)`);
        }
      }

      // ── On-chain position P&L + stop-loss ────────────────────────────────
      if (onChainPositions.length === 0) {
        log('pnl', 'no open on-chain positions');
        return;
      }

      log('pnl', `on-chain positions: ${onChainPositions.length}`);
      for (const pos of onChainPositions) {
        const currentPrice = priceOf(pos.token);
        if (currentPrice === null) {
          log('pnl', `[on-chain] ${pos.token}  follower=${pos.follower.slice(0, 10)}…  price unknown — skipping`);
          continue;
        }

        const pct  = (currentPrice - pos.entryPrice) / pos.entryPrice;
        const pnl  = pos.ausdcAllocated * pct;
        const sign = pnl >= 0 ? '+' : '';
        log('pnl', `[on-chain] follower=${pos.follower.slice(0, 10)}… ${pos.token}  entry=$${pos.entryPrice.toFixed(6)}  now=$${currentPrice.toFixed(6)}  unrealised=${sign}$${pnl.toFixed(4)} (${sign}${(pct * 100).toFixed(2)}%)`);

        if (Math.abs(pct) > 0.5) {
          warn('pnl', `large swing — follower=${pos.follower.slice(0, 10)}… ${(pct * 100).toFixed(1)}%`);
        }

        // ── Stop-loss (per-vault threshold from DB) ───────────────────────
        const stopLossThreshold = pos.stopLossPct / 100;
        if (pct < -stopLossThreshold) {
          if (closingSet.has(pos.onChainPositionId)) {
            log('pnl', `stop-loss already in progress for posId=${pos.onChainPositionId.slice(0, 10)}…`);
            continue;
          }
          closingSet.add(pos.onChainPositionId);
          // Run async — don't block the poll cycle
          triggerStopLoss(pos.onChainPositionId, pos.token, pos.follower, pct).catch((e) => {
            error('pnl', `stop-loss execution failed for posId=${pos.onChainPositionId.slice(0, 10)}…`, e);
            closingSet.delete(pos.onChainPositionId);
          });
        }
      }
    } catch (e) {
      error('pnl', 'P&L update cycle failed', e);
    }
  }, 60_000);

  return () => clearInterval(timer);
}
