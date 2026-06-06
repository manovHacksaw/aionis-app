// src/app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, type Variants } from 'framer-motion';
import Link from 'next/link';

type Summary = {
  totalLocked:   number;
  unrealizedPnl: number;
  realizedPnl:   number;
  activeVaults:  number;
};

type ClosedPosition = {
  id:         string;
  leader:     string;
  token:      string;
  pnl:        number | null;
  closedAt:   string | null;
  txHashClose: string | null;
};

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const timeAgo = (iso: string | null) => {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const fade: Variants = {
  hidden: { opacity: 0, y: 12 },
  show:   (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] } }),
};

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [activity, setActivity] = useState<ClosedPosition[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/portfolio?address=${address}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary ?? null);
        setActivity(d.recentClosed ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address]);

  const stats = summary
    ? [
        { label: 'aUSD Locked',    value: `${summary.totalLocked.toLocaleString()}`,    suffix: 'aUSD', color: 'text-white' },
        { label: 'Unrealized P&L', value: `${summary.unrealizedPnl >= 0 ? '+' : ''}${summary.unrealizedPnl.toFixed(2)}`, suffix: 'aUSD', color: summary.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
        { label: 'Active Vaults',  value: summary.activeVaults.toString(), suffix: '', color: 'text-white' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-16 py-12 max-w-5xl mx-auto w-full font-sans select-none">

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}>
        <h1 className="text-[28px] font-light tracking-[-0.04em] text-white mb-1">Dashboard</h1>
        <p className="text-[14px] text-neutral-400 font-normal">Your copy-trading activity at a glance.</p>
      </motion.div>

      {/* Not connected */}
      {!isConnected && (
        <div className="mt-16 py-24 text-center border border-white/[0.05] rounded-2xl">
          <p className="text-neutral-500 text-[14px]">Connect your wallet to see your dashboard.</p>
        </div>
      )}

      {isConnected && loading && (
        <div className="mt-16 py-24 text-center text-neutral-600 text-[14px]">Loading…</div>
      )}

      {isConnected && !loading && (
        <>
          {/* Stats */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  custom={i}
                  variants={fade}
                  initial="hidden"
                  animate="show"
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-5"
                >
                  <p className="text-[11px] uppercase tracking-widest text-neutral-600 mb-2">{s.label}</p>
                  <p className={`text-[22px] font-light tracking-tight tabular-nums ${s.color}`}>
                    {s.value}
                    {s.suffix && <span className="text-[14px] text-neutral-600 ml-1.5">{s.suffix}</span>}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {/* No data yet */}
          {!summary && (
            <div className="mt-16 py-16 text-center border border-white/[0.05] rounded-2xl">
              <p className="text-neutral-600 text-[14px] mb-1">No activity yet.</p>
              <p className="text-neutral-700 text-[13px]">Create a vault to start copying trades.</p>
            </div>
          )}

          {/* Recent closed positions */}
          {activity.length > 0 && (
            <div className="mt-12">
              <p className="text-[11px] uppercase tracking-widest text-neutral-700 mb-4">Recent Closed Positions</p>
              <div className="flex flex-col gap-1">
                {activity.map((pos, i) => (
                  <motion.div
                    key={pos.id}
                    custom={i}
                    variants={fade}
                    initial="hidden"
                    animate="show"
                    className="flex items-center justify-between rounded-xl px-5 py-4 border border-transparent hover:border-white/[0.06] hover:bg-white/[0.02] transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        (pos.pnl ?? 0) > 0 ? 'bg-emerald-400' :
                        (pos.pnl ?? 0) < 0 ? 'bg-red-400' : 'bg-white/20'
                      }`} />
                      <div>
                        <p className="text-[13px] text-white/90">
                          Position closed · <span className="text-neutral-400">{pos.token}</span>
                        </p>
                        <p className="text-[11px] text-neutral-600 mt-0.5">
                          Leader {fmt(pos.leader)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[13px] tabular-nums ${
                        (pos.pnl ?? 0) > 0 ? 'text-emerald-400' :
                        (pos.pnl ?? 0) < 0 ? 'text-red-400' : 'text-neutral-400'
                      }`}>
                        {(pos.pnl ?? 0) > 0 ? '+' : ''}{(pos.pnl ?? 0).toFixed(2)} aUSD
                      </p>
                      <p className="text-[11px] text-neutral-700 mt-0.5">{timeAgo(pos.closedAt)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="mt-12 flex items-center gap-8">
            <Link href="/traders"  className="text-[14px] text-neutral-500 hover:text-white transition-colors duration-300">Browse Traders →</Link>
            <Link href="/portfolio" className="text-[14px] text-neutral-500 hover:text-white transition-colors duration-300">View Portfolio →</Link>
          </div>
        </>
      )}
    </div>
  );
}
