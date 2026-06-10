'use client';

import * as React from 'react';
import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useVault } from '@/hooks/useVault';
import Avatar from '@/components/Avatar';

type RecentTrade = {
  id:             string;
  token:          string;
  ausdcAllocated: number;
  pnl:            number | null;
  status:         'OPEN' | 'CLOSED' | 'SKIPPED';
  txHashOpen:     string | null;
  openedAt:       string;
  closedAt:       string | null;
};

type LeaderStats = {
  followerCount:     number;
  wsomiPrice:        number;
  stats24h: { trades: number; volume: number; buys: number; sells: number };
  lastSeen:          string | null;
  totalProfitYielded?: number;
  winRate:           number | null;
  closedPositions:   number;
  recentSwaps?:      any[];
  recentTrades?:     RecentTrade[];
};

const TokenLogo = ({ symbol }: { symbol: string }) => {
  const sym = symbol.toUpperCase();
  let src = '';
  if (sym === 'WSOMI' || sym === 'SOMI') src = '/token-logos/WSOMI.png';
  else if (sym === 'USDC.E' || sym === 'USDC') src = '/token-logos/USDC.png';
  else if (sym === 'AUSD') src = '/token-logos/aUSD.svg';

  if (src) {
    return (
      <img
        src={src}
        alt={symbol}
        className="w-5 h-5 rounded-full object-cover border border-border bg-surface flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-surface to-border border border-border/60 flex items-center justify-center flex-shrink-0 select-none">
      <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2" />
        <path d="M12 6v12" />
      </svg>
    </div>
  );
};

function fmt(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

interface PageProps {
  params: Promise<{ address: string }> | { address: string };
}

export default function TraderDetailsPage({ params }: PageProps) {
  const resolvedParams  = params instanceof Promise ? use(params) : params;
  const leaderAddress   = resolvedParams.address as `0x${string}`;
  const router          = useRouter();
  const { isConnected } = useAccount();

  // Check if copy trading is active/paused
  const { vaultStatus, lockedBalance } = useVault(leaderAddress);
  const isManaging = (vaultStatus === 'ACTIVE' || vaultStatus === 'PAUSED') && (lockedBalance ?? 0) > 0;

  const [stats,    setStats]    = useState<LeaderStats | null>(null);
  const [statsErr, setStatsErr] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const [inference,    setInference]    = useState<string | null>(null);
  const [inferenceLoading, setInferenceLoading] = useState(true);

  useEffect(() => {
    if (!leaderAddress) return;
    fetch(`/api/traders/${leaderAddress}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStatsErr(true));
  }, [leaderAddress]);

  useEffect(() => {
    if (!leaderAddress) return;
    fetch(`/api/traders/${leaderAddress}/inference`)
      .then((r) => r.json())
      .then((d) => setInference(d.summary ?? null))
      .catch(() => setInference(null))
      .finally(() => setInferenceLoading(false));
  }, [leaderAddress]);

  const handleCopy = () => {
    navigator.clipboard.writeText(leaderAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const total24h  = (stats?.stats24h.buys ?? 0) + (stats?.stats24h.sells ?? 0);
  const buyPct    = total24h > 0 ? Math.round((stats!.stats24h.buys / total24h) * 100) : 0;
  const vol       = stats?.stats24h.volume ?? 0;
  const volFmt    = vol >= 1000 ? `$${(vol / 1000).toFixed(1)}k` : `$${vol.toFixed(0)}`;
  const profitYielded = stats?.totalProfitYielded ?? 0;
  const profitFmt     = `${profitYielded >= 0 ? '+' : ''}${profitYielded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} aUSD`;

  const ADDRESS_TO_SYMBOL: Record<string, string> = {
    '0x046ede9564a72571df6f5e44d0405360c0f4dcab': 'WSOMI',
    '0x28bec7e30e6faee657a03e19bf1128aad7632a00': 'USDC',
    '0xc063b29cd6b30885783b505ae180b3079e0a2154': 'NIA',
    '0x67b302e35aef5eee8c32d934f5856869ef428330': 'USDT',
  };

  const getSymbol = (addr: string) =>
    ADDRESS_TO_SYMBOL[addr.toLowerCase()] ?? `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className="text-foreground px-[7.5%] py-8 w-full select-none">
      <div className="mb-8">
        <Link href="/traders" className="text-foreground/40 hover:text-foreground text-sm transition-spring hover:scale-105 active:scale-95 flex items-center gap-2 w-fit">
          <span>←</span> Discover
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Leader Info & Stats */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 transition-spring animate-scale-in">
            <div className="flex items-center gap-3 mb-6">
              <Avatar address={leaderAddress} size={36} />
              <div>
                <div className="text-[10px] text-foreground/30 uppercase tracking-wide">Copying Leader</div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  <div onClick={handleCopy}
                    className="font-mono text-sm tracking-tight text-foreground/90 hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5 relative">
                    <span>{fmt(leaderAddress)}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 text-foreground/40">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.25 2.25 0 0 0-1.75 3.364M18.75 7.5V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V7.5M18.75 7.5V5.25A2.25 2.25 0 0 0 16.5 3h-9A2.25 2.25 0 0 0 5.25 5.25V7.5m13.5 0h-13.5" />
                    </svg>
                    {copied && (
                      <span className="absolute -top-8 left-0 bg-accent text-accent-foreground text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded z-50">
                        Copied!
                      </span>
                    )}
                  </div>
                  <a
                    href={`https://explorer.somnia.network/address/${leaderAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/40 hover:text-accent-hover transition-colors flex items-center"
                    title="View on Explorer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-foreground/[0.05] pb-6 mb-4">
              {[
                {
                  label: '24h Volume',
                  value: statsErr ? '—' : stats ? volFmt : (
                    <div className="h-6 w-16 bg-surface/40 rounded animate-shimmer mt-0.5" />
                  )
                },
                {
                  label: '24h Trades',
                  value: statsErr ? '—' : stats ? String(stats.stats24h.trades) : (
                    <div className="h-6 w-10 bg-surface/40 rounded animate-shimmer mt-0.5" />
                  )
                },
                {
                  label: 'Buy %',
                  value: statsErr ? '—' : stats ? `${buyPct}%` : (
                    <div className="h-6 w-12 bg-surface/40 rounded animate-shimmer mt-0.5" />
                  ),
                  color: !stats ? '' : buyPct >= 50 ? 'text-emerald-400' : 'text-red-400'
                },
                {
                  label: 'Followers',
                  value: statsErr ? '—' : stats ? String(stats.followerCount) : (
                    <div className="h-6 w-8 bg-surface/40 rounded animate-shimmer mt-0.5" />
                  )
                },
                {
                  label: 'Win Rate',
                  value: statsErr ? '—' : stats
                    ? (stats.winRate !== null ? `${stats.winRate}%` : '—')
                    : <div className="h-6 w-12 bg-surface/40 rounded animate-shimmer mt-0.5" />,
                  color: !stats || stats.winRate === null ? 'text-subtle'
                    : stats.winRate >= 50 ? 'text-emerald-400'
                    : stats.winRate >= 30 ? 'text-amber-400'
                    : 'text-red-400',
                },
                {
                  label: 'Closed Positions',
                  value: statsErr ? '—' : stats ? String(stats.closedPositions) : (
                    <div className="h-6 w-8 bg-surface/40 rounded animate-shimmer mt-0.5" />
                  )
                },
                {
                  label: 'Total Profits Copy-Traded',
                  value: statsErr ? '—' : stats ? profitFmt : (
                    <div className="h-6 w-24 bg-surface/40 rounded animate-shimmer mt-0.5" />
                  ),
                  color: !stats ? '' : profitYielded >= 0 ? 'text-emerald-400' : 'text-red-400',
                  fullWidth: true
                },
              ].map(({ label, value, color, fullWidth }) => (
                <div key={label} className={fullWidth ? 'col-span-2 border-t border-foreground/[0.03] pt-3 mt-1' : ''}>
                  <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">{label}</div>
                  <div className={`text-lg font-light tabular-nums ${color ?? 'text-foreground'}`}>{value}</div>
                </div>
              ))}
            </div>

            <p className="text-foreground/30 text-[11px] leading-relaxed">
              Activity recorded on Somnia Mainnet. Copying occurs on Somnia Testnet (chain 50312) using aUSD.
            </p>
          </div>

          {/* AI Analysis */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 transition-spring animate-fade-in-up">
            <div className="flex items-center gap-1.5 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-accent">
                <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5Z" clipRule="evenodd" />
              </svg>
              <span className="text-[10px] uppercase tracking-wider text-foreground/40">AI Analysis · Generated by AI</span>
            </div>
            {inferenceLoading ? (
              <div className="space-y-2">
                <div className="h-3 w-full bg-surface/40 rounded animate-shimmer" />
                <div className="h-3 w-[90%] bg-surface/40 rounded animate-shimmer" />
                <div className="h-3 w-[60%] bg-surface/40 rounded animate-shimmer" />
              </div>
            ) : inference ? (
              <p className="text-[13px] text-muted leading-relaxed font-light">{inference}</p>
            ) : (
              <p className="text-[13px] text-subtle leading-relaxed font-light">
                Not enough on-chain history yet to generate an analysis for this trader.
              </p>
            )}
          </div>
        </div>

        {/* Right: Copy Action Card & Mainnet Swaps */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Action Trigger Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 transition-spring animate-fade-in-up">
            {isManaging ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[13px] font-medium text-emerald-400">Copy Agent Active</span>
                  </div>
                  <span className="text-[11px] text-subtle font-mono">{fmt(leaderAddress)}</span>
                </div>
                <p className="text-[13px] text-muted leading-relaxed font-light">
                  You have an active copy-trading agent configured for this trader. You can manage settings, adjust capital allocation, or view agent logs.
                </p>
                <button
                  onClick={() => router.push(`/traders/${leaderAddress}/manage`)}
                  className="w-full rounded-xl bg-accent hover:bg-accent-hover text-accent-foreground text-[13px] font-semibold py-3 transition-spring hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-md shadow-accent/15"
                >
                  Manage Agent Settings
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-[18px] font-light text-foreground tracking-tight">Automate Copy-Trading</h3>
                <p className="text-[13px] text-muted leading-relaxed font-light">
                  Deploy a personalized AI copy-trading agent to copy this leader&apos;s moves on Somnia Testnet automatically. You will lock your aUSD to back the trades and define custom risk settings.
                </p>
                <button
                  onClick={() => router.push(`/traders/${leaderAddress}/deploy`)}
                  className="w-full rounded-xl bg-foreground/[0.06] hover:bg-foreground/10 border border-foreground/10 text-foreground text-[13px] font-medium py-3 transition-spring hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  Copy Trader
                </button>
              </div>
            )}
          </div>

          {/* Mainnet Swaps Feed */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4">
            <div className="border-b border-border/60 pb-2.5">
              <h3 className="text-[13px] font-medium text-muted">Leader Swaps</h3>
              <p className="text-[11px] text-subtle mt-0.5">Actual swaps executed by the leader on Somnia Mainnet pools.</p>
            </div>

            {!stats?.recentSwaps || stats.recentSwaps.length === 0 ? (
              <p className="text-[12px] text-subtle">No mainnet swaps observed yet for this leader address.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {stats.recentSwaps.map((s) => (
                  <div key={s.id} className="px-3 py-2.5 bg-surface/50 border border-border rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          s.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {s.side}
                        </span>
                        <span className="text-[12px] text-muted font-semibold">
                          {s.side === 'BUY' ? getSymbol(s.tokenOut) : getSymbol(s.tokenIn)}
                        </span>
                      </div>
                      <p className="text-[10px] text-subtle mt-1">
                        Value: ${s.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} · Price: ${s.wsomiPrice.toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-subtle block">{new Date(s.timestamp).toLocaleTimeString()}</span>
                      {s.txHash && (
                        <a
                          href={`https://explorer.somnia.network/tx/${s.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-subtle hover:text-accent-hover inline-flex items-center gap-0.5 mt-0.5"
                        >
                          Tx
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Copy Activity */}
          {stats?.recentTrades && stats.recentTrades.length > 0 && (
            <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4">
              <div className="border-b border-border/60 pb-2.5">
                <h3 className="text-[13px] font-medium text-muted">Recent Copy Activity</h3>
                <p className="text-[11px] text-subtle mt-0.5">Positions opened by followers copying this leader.</p>
              </div>
              <div className="flex flex-col gap-2">
                {stats.recentTrades.slice(0, 6).map((t) => {
                  const isProfit = (t.pnl ?? 0) >= 0;
                  return (
                    <div key={t.id} className="px-3 py-2.5 bg-surface/50 border border-border rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          t.status === 'OPEN'   ? 'bg-emerald-500/10 text-emerald-400' :
                          t.status === 'CLOSED' ? 'bg-blue-500/10 text-blue-400' :
                                                  'bg-amber-500/10 text-amber-400'
                        }`}>{t.status.toLowerCase()}</span>
                        <span className="text-[12px] text-muted font-semibold">{t.token}</span>
                        <span className="text-[11px] text-subtle">{t.ausdcAllocated.toFixed(1)} aUSD</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {t.pnl !== null && t.status === 'CLOSED' && (
                          <span className={`text-[12px] font-semibold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{t.pnl.toFixed(2)}
                          </span>
                        )}
                        <span className="text-[10px] text-subtle">
                          {new Date(t.openedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        {t.txHashOpen && (
                          <a
                            href={`https://testnet.somnia.exploreme.pro/tx/${t.txHashOpen}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-subtle hover:text-accent-hover"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
