import { getCurrentWsomiPrice } from './price.js';
/** Polls open positions every 60s and logs unrealised P&L. */
export function startPnlUpdater(db) {
    const timer = setInterval(async () => {
        try {
            const price = await getCurrentWsomiPrice();
            await db.upsertTokenPrice('WSOMI', price);
            const positions = await db.getAllOpenPositions();
            for (const pos of positions) {
                const pct = (price - pos.entryPrice) / pos.entryPrice;
                const pnl = pos.usdcSpent * pct;
                console.log(`[pnl] ${pos.follower.slice(0, 8)}… ${pos.token} ` +
                    `entry $${pos.entryPrice.toFixed(4)} now $${price.toFixed(4)} ` +
                    `unrealised: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${(pct * 100).toFixed(2)}%)`);
            }
        }
        catch (e) {
            console.error('[pnl-updater] error:', e.message);
        }
    }, 60_000);
    return () => clearInterval(timer);
}
