import 'dotenv/config';
import { createServer } from 'node:http';
import { createPrismaDb, disconnectPrisma } from './db.js';
import { startWatcher } from './watcher.js';
import { startPnlUpdater } from './pnl-updater.js';
import { closeRedis } from './dedup.js';
const db = createPrismaDb();
console.log('Starting StellaAlpha watcher on Somnia Mainnet…');
const stopWatcher = await startWatcher(db);
const stopPnlUpdater = startPnlUpdater(db);
// Render web services require an HTTP port to be bound — this also doubles
// as the endpoint the keep-alive cron pings to stop the free instance idling.
const PORT = process.env.PORT ?? 8787;
const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }
    res.writeHead(404);
    res.end();
});
server.listen(PORT, () => console.log(`[health] listening on :${PORT}`));
async function shutdown() {
    console.log('\nShutting down…');
    server.close();
    stopWatcher();
    stopPnlUpdater();
    await closeRedis();
    await disconnectPrisma();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
