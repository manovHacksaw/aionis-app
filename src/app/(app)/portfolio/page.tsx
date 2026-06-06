// src/app/(app)/portfolio/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const MOCK_HAS_VAULTS = true; // Toggle empty vs non-empty state

const MOCK_VAULTS = [
  { leader: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", locked: 500, pnl: 47.3, risk: 3, status: "ACTIVE" },
  { leader: "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c", locked: 200, pnl: -12.1, risk: 2, status: "ACTIVE" },
];

export default function PortfolioPage() {
  const router = useRouter();
  const [hasVaults] = useState(MOCK_HAS_VAULTS);

  // Computations
  const totalLocked = MOCK_VAULTS.reduce((sum, v) => sum + v.locked, 0);
  const totalPnl = MOCK_VAULTS.reduce((sum, v) => sum + v.pnl, 0);
  const activeVaultCount = MOCK_VAULTS.length;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  const renderRiskDots = (risk: number) => {
    return (
      <div className="flex gap-1 items-center">
        {[1, 2, 3, 4, 5].map((dot) => (
          <div
            key={dot}
            className={`w-1.5 h-1.5 rounded-full ${
              dot <= risk ? 'bg-[#d97706]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-16 py-12 max-w-6xl mx-auto w-full select-none">
      {/* Page Title */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-3">
          Portfolio
        </h1>
        <p className="text-white/40 text-sm max-w-md">
          Monitor your deployed capital, tracking returns and managing active copying rules.
        </p>
      </div>

      {!hasVaults ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center justify-center border border-white/[0.06] rounded-2xl bg-white/[0.01] py-24 px-6 text-center"
        >
          <div className="text-white/30 text-lg font-medium mb-2">No active vaults</div>
          <p className="text-white/40 text-xs max-w-xs mb-8">
            You are not currently copying any traders. Explore the leaderboard to set up your first copy trading vault.
          </p>
          <button
            onClick={() => router.push('/traders')}
            className="bg-white hover:bg-neutral-200 text-black font-medium text-sm rounded-full px-6 py-2.5 transition-colors duration-200 cursor-pointer"
          >
            Browse Traders
          </button>
        </motion.div>
      ) : (
        /* Non-Empty State */
        <div className="space-y-10">
          {/* Top Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Locked */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">
                Total Locked
              </span>
              <span className="text-2xl font-mono font-medium text-white">
                {totalLocked.toLocaleString()} aUSD
              </span>
            </div>

            {/* Unrealized P&L */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">
                Unrealized P&L
              </span>
              <span className={`text-2xl font-mono font-medium ${totalPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
            </div>

            {/* Active Vaults */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">
                Active Vaults
              </span>
              <span className="text-2xl font-mono font-medium text-white">
                {activeVaultCount}
              </span>
            </div>
          </div>

          {/* Vault List Header */}
          <div>
            <h2 className="text-lg font-medium text-white/80 mb-4">Active Vaults</h2>
            <div className="space-y-3">
              {MOCK_VAULTS.map((vault) => (
                <div
                  key={vault.leader}
                  className="bg-white/[0.03] border border-white/[0.07] hover:border-white/20 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300"
                >
                  {/* Left: Leader address */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_12px_rgba(217,119,6,0.15)] flex-shrink-0" />
                    <div>
                      <span className="font-mono text-sm tracking-tight text-white block">
                        {formatAddress(vault.leader)}
                      </span>
                      <span className="text-[10px] text-white/30 uppercase tracking-wide">
                        Leader
                      </span>
                    </div>
                  </div>

                  {/* Middle: Locked, P&L, Risk */}
                  <div className="grid grid-cols-3 gap-6 flex-grow max-w-lg">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-1">
                        Locked
                      </span>
                      <span className="text-sm font-mono text-white/90">
                        {vault.locked} aUSD
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-1">
                        P&L
                      </span>
                      <span className={`text-sm font-mono font-semibold ${vault.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {vault.pnl >= 0 ? '+' : ''}${vault.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-1">
                        Risk Level
                      </span>
                      <div className="mt-1">{renderRiskDots(vault.risk)}</div>
                    </div>
                  </div>

                  {/* Right: Status badge & Action */}
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-white/[0.05] pt-4 md:pt-0">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                      <span className="text-xs text-[#22c55e] font-medium tracking-wide uppercase">
                        {vault.status}
                      </span>
                    </div>

                    <button
                      onClick={() => router.push(`/vault/${vault.leader}`)}
                      className="bg-transparent hover:bg-white/5 border border-white/20 hover:border-white/40 text-white font-medium text-xs rounded-full px-5 py-2 transition-all duration-200 cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
