// src/app/(app)/portfolio/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';

type Position = {
  id:            string;
  token:         string;
  ausdcAllocated: number;
  entryPrice:    number;
  unrealizedPnl: number;
  status:        string;
  openedAt:      string;
};

type Vault = {
  id:            string;
  leader:        string;
  ausdcLocked:   number;
  riskLevel:     number;
  status:        string;
  unrealizedPnl: number;
  positions:     Position[];
};

type Summary = { totalLocked: number; totalPnl: number; activeCount: number };

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const RiskDots = ({ level }: { level: number }) => (
  <div className="flex gap-1">
    {[1,2,3,4,5].map((d) => (
      <div key={d} className={`w-1.5 h-1.5 rounded-full ${d <= level ? 'bg-amber-500' : 'bg-white/10'}`} />
    ))}
  </div>
);

export default function PortfolioPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [vaults,  setVaults]  = useState<Vault[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    fetch(`/api/vaults/${address}`)
      .then((r) => r.json())
      .then((d) => {
        setVaults(d.vaults ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => setError('Failed to load portfolio.'))
      .finally(() => setLoading(false));
  }, [address]);

  const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16,1,0.3,1] as const } } };

  return (
    <div className="text-white px-16 py-8 max-w-[1440px] mx-auto w-full select-none font-sans">
      <div className="mb-10">
        <h1 className="text-[28px] font-light tracking-[-0.04em] text-white mb-1">Portfolio</h1>
        <p className="text-[14px] text-neutral-400 font-normal">Your active copy-trading vaults.</p>
      </div>

      {/* Not connected */}
      {!isConnected && (
        <div className="py-24 text-center border border-zinc-800/50 rounded-2xl">
          <p className="text-neutral-500 text-[14px] mb-1">Connect your wallet to view your portfolio.</p>
        </div>
      )}

      {/* Loading */}
      {isConnected && loading && (
        <div className="py-24 text-center text-neutral-600 text-[14px]">Loading…</div>
      )}

      {/* Error */}
      {isConnected && error && (
        <div className="py-24 text-center text-red-500/60 text-[14px]">{error}</div>
      )}

      {/* Empty */}
      {isConnected && !loading && !error && vaults.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
          className="py-24 text-center border border-zinc-800/50 rounded-2xl"
        >
          <p className="text-neutral-500 text-[14px] mb-1">No active vaults yet.</p>
          <p className="text-neutral-700 text-[13px] mb-8">Pick a trader to start copying their moves.</p>
          <button
            onClick={() => router.push('/traders')}
            className="rounded-full border border-white/[0.18] bg-white/[0.03] text-white/90 text-[13px] px-5 py-2 hover:bg-white/[0.08] hover:border-white/40 transition-all duration-300 cursor-pointer"
          >
            Browse Traders
          </button>
        </motion.div>
      )}

      {/* Data */}
      {isConnected && !loading && !error && vaults.length > 0 && summary && (
        <motion.div variants={{ show: { transition: { staggerChildren: 0.07 } } }} initial="hidden" animate="show" className="space-y-8">

          {/* Summary row */}
          <motion.div variants={fade} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Locked',    value: `${summary.totalLocked.toLocaleString()} aUSD`, color: 'text-white' },
              { label: 'Unrealized P&L',  value: `${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(2)} aUSD`, color: summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Active Vaults',   value: summary.activeCount.toString(), color: 'text-white' },
            ].map((s) => (
              <div key={s.label} className="bg-[#191919] border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] rounded-2xl px-6 py-5">
                <p className="text-[11px] uppercase tracking-widest text-neutral-600 mb-2">{s.label}</p>
                <p className={`text-[22px] font-light tracking-tight tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </motion.div>

          {/* Vault list */}
          <div>
            <p className="text-[11px] uppercase tracking-widest text-neutral-700 mb-4">Active Vaults</p>
            <div className="flex flex-col gap-2">
              {vaults.map((vault) => (
                <motion.div
                  key={vault.id}
                  variants={fade}
                  className="bg-[#191919] border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-200"
                >
                  {/* Leader */}
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex-shrink-0" />
                    <div>
                      <p className="font-mono text-[13px] text-white/90">{fmt(vault.leader)}</p>
                      <p className="text-[10px] text-neutral-700 uppercase tracking-wide mt-0.5">Leader</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-6 flex-grow max-w-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-700 mb-1">Locked</p>
                      <p className="text-[13px] text-white/80 tabular-nums">{vault.ausdcLocked} aUSD</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-700 mb-1">P&L</p>
                      <p className={`text-[13px] tabular-nums font-normal ${vault.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {vault.unrealizedPnl >= 0 ? '+' : ''}{vault.unrealizedPnl.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-700 mb-1">Risk</p>
                      <RiskDots level={vault.riskLevel} />
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${vault.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className={`text-[12px] ${vault.status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {vault.status}
                      </span>
                    </div>
                    <button
                      onClick={() => router.push(`/vault/${vault.leader}`)}
                      className="rounded-full border border-white/[0.15] text-white/80 text-[12px] px-4 py-1.5 hover:text-white hover:border-white/30 transition-all duration-200 cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
