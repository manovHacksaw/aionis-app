'use client';

import { useEffect, useRef, useState } from 'react';

type WatcherEvent = {
  type:       'OPENED' | 'CLOSED' | 'SKIPPED';
  follower:   string;
  leader:     string;
  token:      string | null;
  amount:     number | null;
  pnl:        number | null;
  reason:     string | null;
  txHash:     string | null;
  happenedAt: string;
};

type WatcherLog = {
  ts:    number;
  level: 'info' | 'warn' | 'error';
  tag:   string;
  msg:   string;
};

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const TokenLogo = ({ symbol }: { symbol: string }) => {
  const sym = symbol.toUpperCase();
  let src = '';
  if (sym === 'WSOMI' || sym === 'SOMI') src = '/token-logos/WSOMI.png';
  else if (sym === 'USDC' || sym === 'USDC.E') src = '/token-logos/USDC.png';

  if (src) {
    return (
      <img
        src={src}
        alt={symbol}
        className="w-6 h-6 rounded-full object-cover border border-border bg-surface flex-shrink-0"
        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-surface to-border border border-border/60 flex items-center justify-center text-[10px] text-muted font-bold uppercase flex-shrink-0 select-none">
      {symbol.slice(0, 2)}
    </div>
  );
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

export default function WatcherActivityPage() {
  const [events, setEvents] = useState<WatcherEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [watcherOnline, setWatcherOnline] = useState<boolean | null>(null);
  const [watcherAgeMs,  setWatcherAgeMs]  = useState<number | null>(null);

  const [logs, setLogs] = useState<WatcherLog[]>([]);

  const ref = useRef(false);

  useEffect(() => {
    const poll = () => {
      fetch('/api/watcher/activity')
        .then((r) => r.json())
        .then((d) => { if (d.events) setEvents(d.events); })
        .catch(() => setError('Failed to load watcher activity.'))
        .finally(() => setLoading(false));

      fetch('/api/watcher/status')
        .then((r) => r.json())
        .then((d) => { setWatcherOnline(d.online); setWatcherAgeMs(d.ageMs); })
        .catch(() => setWatcherOnline(false));
    };

    if (!ref.current) { poll(); ref.current = true; }
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const pollLogs = () => {
      fetch('/api/watcher/logs')
        .then((r) => r.json())
        .then((d) => { if (d.logs) setLogs(d.logs); })
        .catch(() => {});
    };
    pollLogs();
    const id = setInterval(pollLogs, 3_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-foreground px-[7.5%] py-8 w-full select-none">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-light tracking-[-0.04em] text-foreground mb-1">Watcher Activity</h1>
          <p className="text-[14px] text-muted font-normal">
            A live feed of every decision Aionis agents have made on Somnia — opened, closed, and skipped trades.
          </p>
        </div>

        {watcherOnline !== null && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] self-start md:self-auto ${
            watcherOnline && watcherAgeMs !== null && watcherAgeMs < 30_000
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : watcherOnline
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              watcherOnline && watcherAgeMs !== null && watcherAgeMs < 30_000
                ? 'bg-emerald-400 animate-pulse'
                : watcherOnline
                ? 'bg-amber-400'
                : 'bg-red-400'
            }`} />
            <span>
              {watcherOnline
                ? `Watcher · ${watcherAgeMs !== null && watcherAgeMs < 60_000 ? `checked ${Math.round(watcherAgeMs / 1000)}s ago` : 'active'}`
                : 'Watcher offline'}
            </span>
          </div>
        )}
      </div>

      {/* Live console */}
      <div className="mb-8 bg-[#0a0a0c] border border-border/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[12px] text-white/70 font-mono">Watcher Console</span>
          </div>
          <span className="text-[11px] text-white/30 font-mono">live · streaming every 3s</span>
        </div>
        <div className="px-5 py-3 max-h-[280px] overflow-y-auto font-mono text-[12px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-white/30">Waiting for watcher output…</p>
          ) : (
            logs.map((l, idx) => (
              <div
                key={`${l.ts}-${idx}`}
                className={`whitespace-pre-wrap break-all ${
                  l.level === 'error' ? 'text-red-400'
                    : l.level === 'warn' ? 'text-amber-400'
                    : 'text-white/60'
                } ${idx === 0 ? 'animate-fade-in-up' : ''}`}
              >
                <span className="text-white/25">{new Date(l.ts).toLocaleTimeString()}</span>{' '}
                <span className="text-emerald-400/70">[{l.tag}]</span>{' '}
                {l.msg}
              </div>
            ))
          )}
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[64px] border border-border/60 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 45}ms` }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="py-24 text-center text-red-500/60 text-[14px] bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="py-24 text-center border border-border/50 rounded-2xl bg-card/50">
          <p className="text-subtle text-[14px]">No watcher activity yet.</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="bg-surface border border-border shadow-xl rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/60">
            {events.map((ev, idx) => (
              <div
                key={`${ev.txHash}-${ev.type}-${idx}`}
                className="flex items-center gap-4 px-6 py-4 text-[13px] hover:bg-surface/30 transition-spring animate-fade-in-up"
                style={{ animationDelay: `${(idx % 15) * 35}ms` }}
              >
                {/* Status dot */}
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  ev.type === 'OPENED'
                    ? 'bg-emerald-400 animate-pulse'
                    : ev.type === 'SKIPPED'
                    ? 'bg-amber-400'
                    : 'bg-blue-400'
                }`} />

                {/* Token */}
                <div className="w-6 flex-shrink-0">
                  {ev.token ? <TokenLogo symbol={ev.token} /> : <div className="w-6 h-6" />}
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-foreground/90">
                    Agent for{' '}
                    <a
                      href={`https://testnet.somnia.exploreme.pro/address/${ev.follower}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono text-foreground hover:text-accent-hover transition-colors"
                    >
                      {fmt(ev.follower)}
                    </a>{' '}
                    {ev.type === 'OPENED' && (
                      <>opened a <span className="font-medium">{ev.token}</span> position copying{' '}</>
                    )}
                    {ev.type === 'CLOSED' && (
                      <>closed a <span className="font-medium">{ev.token}</span> position copying{' '}</>
                    )}
                    {ev.type === 'SKIPPED' && <>skipped a trade copying{' '}</>}
                    <a
                      href={`https://testnet.somnia.exploreme.pro/address/${ev.leader}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono text-muted hover:text-accent-hover transition-colors"
                    >
                      {fmt(ev.leader)}
                    </a>
                  </p>
                  {ev.type === 'SKIPPED' && ev.reason && (
                    <p className="text-[11px] text-amber-400/70 mt-0.5">{ev.reason}</p>
                  )}
                  {ev.type === 'CLOSED' && ev.reason === 'STOP_LOSS' && (
                    <p className="text-[11px] text-red-400/70 mt-0.5">Closed automatically · stop-loss</p>
                  )}
                </div>

                {/* Amount / P&L */}
                <div className="text-right flex-shrink-0 tabular-nums">
                  {ev.type === 'OPENED' && ev.amount != null && (
                    <span className="text-foreground/80">{ev.amount.toFixed(2)} aUSD</span>
                  )}
                  {ev.type === 'CLOSED' && ev.pnl != null && (
                    <span className={ev.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {ev.pnl >= 0 ? '+' : ''}{ev.pnl.toFixed(2)} aUSD
                    </span>
                  )}
                </div>

                {/* Time + link */}
                <div className="flex items-center gap-3 flex-shrink-0 w-[110px] justify-end">
                  <span className="text-subtle whitespace-nowrap">{timeAgo(ev.happenedAt)}</span>
                  {ev.txHash && (
                    <a
                      href={`https://testnet.somnia.exploreme.pro/tx/${ev.txHash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-subtle hover:text-foreground transition-colors"
                      title="View transaction"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
