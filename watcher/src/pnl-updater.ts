import { getCurrentWsomiPrice } from './price.js';
import { log, warn, error }     from './logger.js';
import type { Db }              from './db.js';

/** Polls open positions every 60s and logs unrealised P&L. */
export function startPnlUpdater(db: Db): () => void {
  const timer = setInterval(async () => {
    try {
      const price = await getCurrentWsomiPrice();
      log('pnl', `WSOMI price fetched: $${price.toFixed(6)}`);

      await db.upsertTokenPrice('WSOMI', price);

      const positions = await db.getAllOpenPositions();
      if (positions.length === 0) {
        log('pnl', 'no open positions to update');
        return;
      }

      log('pnl', `updating ${positions.length} open position(s)`);
      for (const pos of positions) {
        const pct = (price - pos.entryPrice) / pos.entryPrice;
        const pnl = pos.usdcSpent * pct;
        const sign = pnl >= 0 ? '+' : '';
        log('pnl', `follower=${pos.follower.slice(0, 10)}… ${pos.token}  entry=$${pos.entryPrice.toFixed(6)}  now=$${price.toFixed(6)}  unrealised=${sign}$${pnl.toFixed(4)} (${sign}${(pct * 100).toFixed(2)}%)`);
        if (Math.abs(pct) > 0.5) {
          warn('pnl', `large P&L swing — follower=${pos.follower.slice(0, 10)}… ${(pct * 100).toFixed(1)}%`);
        }
      }
    } catch (e: any) {
      error('pnl', 'P&L update cycle failed', e);
    }
  }, 60_000);

  log('pnl', 'P&L updater started (60s interval)');
  return () => clearInterval(timer);
}
