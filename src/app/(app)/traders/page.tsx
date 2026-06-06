// src/app/(app)/traders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

type Trader = {
  rank:     number;
  address:  string;
  trades:   number;
  volume:   number;
  buys:     number;
  sells:    number;
  lastSeen: string | null;
};

type SortKey = 'volume' | 'trades' | 'buys';
const WINDOWS = ['1h', '6h', '24h'] as const;
type Window = typeof WINDOWS[number];

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const timeAgo = (iso: string | null) => {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function TradersPage() {
  const router = useRouter();
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState<SortKey>('volume');
  const [window,  setWindow]  = useState<Window>('24h');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/traders/leaderboard?window=${window}`)
      .then((r) => r.json())
      .then((d) => setTraders(d.traders ?? []))
      .catch(() => setError('Failed to load traders.'))
      .finally(() => setLoading(false));
  }, [window]);

  const visible = traders
    .filter((t) => t.address.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-16 py-12 max-w-5xl mx-auto w-full select-none font-sans">

      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-light tracking-[-0.04em] text-white mb-1">Traders</h1>
          <p className="text-[14px] text-neutral-400 font-normal">On-chain activity on Somnia mainnet.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Time window pill */}
          <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200 cursor-pointer ${
                  window === w ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2 text-[13px] text-white placeholder-neutral-700 focus:outline-none focus:border-white/20 transition-all w-48 font-sans"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none cursor-pointer font-sans"
          >
            <option value="volume" className="bg-black">Volume</option>
            <option value="trades" className="bg-black">Trades</option>
            <option value="buys"   className="bg-black">Buys</option>
          </select>
        </div>
      </div>

      {/* Column headers */}
      {!loading && !error && visible.length > 0 && (
        <div className="grid grid-cols-[2rem_1fr_6rem_6rem_5rem_6rem_7rem] gap-4 px-4 mb-2 text-[11px] uppercase tracking-widest text-neutral-700">
          <span>#</span>
          <span>Trader</span>
          <span className="text-right">Volume</span>
          <span className="text-right">Trades</span>
          <span className="text-right">Buy %</span>
          <span className="text-right">Last Active</span>
          <span />
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="py-24 text-center text-neutral-600 text-[14px]">Loading…</div>
      )}
      {error && (
        <div className="py-24 text-center text-red-500/60 text-[14px]">{error}</div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div className="py-24 text-center border border-white/[0.05] rounded-2xl">
          <p className="text-neutral-600 text-[14px] mb-1">No traders detected yet.</p>
          <p className="text-neutral-700 text-[13px]">Start the watcher service to populate this list.</p>
        </div>
      )}

      {/* List */}
      {!loading && !error && visible.length > 0 && (
        <div className="flex flex-col gap-1">
          {visible.map((trader, i) => {
            const total    = trader.buys + trader.sells;
            const buyRatio = total > 0 ? Math.round((trader.buys / total) * 100) : 0;

            return (
              <motion.div
                key={trader.address}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-[2rem_1fr_6rem_6rem_5rem_6rem_7rem] gap-4 items-center px-4 py-3.5 rounded-xl border border-transparent hover:border-white/[0.06] hover:bg-white/[0.02] transition-all duration-200"
              >
                <span className="text-[12px] text-neutral-700 tabular-nums">{trader.rank}</span>

                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex-shrink-0" />
                  <span className="font-mono text-[13px] text-white/80 truncate">{fmt(trader.address)}</span>
                </div>

                <span className="text-right text-[13px] text-white/90 tabular-nums font-normal">
                  ${trader.volume >= 1000
                    ? `${(trader.volume / 1000).toFixed(1)}k`
                    : trader.volume.toFixed(0)}
                </span>

                <span className="text-right text-[13px] text-white/90 tabular-nums">{trader.trades}</span>

                <span className={`text-right text-[13px] tabular-nums ${buyRatio >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {buyRatio}%
                </span>

                <span className="text-right text-[12px] text-neutral-500 tabular-nums">
                  {timeAgo(trader.lastSeen)}
                </span>

                <div className="flex justify-end">
                  <button
                    onClick={() => router.push(`/vault/${trader.address}`)}
                    className="rounded-full border border-white/[0.15] bg-transparent text-white/80 text-[12px] px-3 py-1.5 hover:text-white hover:border-white/30 transition-all duration-200 cursor-pointer whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
