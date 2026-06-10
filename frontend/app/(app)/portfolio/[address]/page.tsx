'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { TokenBadge } from '@/components/TokenBadge';
import { aggregateHoldings, fmt, type Agent, type Holding, type Summary } from '@/lib/portfolio';

type PageProps = { params: Promise<{ address: string }> | { address: string } };

export default function PublicPortfolioPage({ params }: PageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const address = resolvedParams.address as `0x${string}`;

  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/vaults/${address}`)
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.vaults ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [address]);

  const holdings = useMemo(() => aggregateHoldings(agents), [agents]);

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/portfolio/${address}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="text-foreground px-[7.5%] py-8 w-full select-none space-y-6">

      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl px-5 py-4 animate-fade-in-up">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar address={address} size={36} />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-foreground/40 mb-0.5">Viewing public agent portfolio</p>
            <p className="font-mono text-[14px] text-foreground/90 truncate">{fmt(address)}</p>
          </div>
        </div>
        <button
          onClick={handleShare}
          className="flex-shrink-0 rounded-xl bg-accent hover:bg-accent-hover text-accent-foreground text-[12px] font-semibold px-4 py-2 transition-spring hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
        >
          {copied ? 'Link copied!' : 'Share ↗'}
        </button>
      </div>

      {loading && (
        <div className="py-24 text-center text-subtle text-[14px]">Loading portfolio…</div>
      )}

      {!loading && error && (
        <div className="py-24 text-center text-red-500/60 text-[14px]">Failed to load this portfolio.</div>
      )}

      {!loading && !error && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Active Agents',     value: `${summary?.activeCount ?? 0}`, color: 'text-accent' },
              { label: 'Deployed in Agents', value: `${(summary?.totalLocked ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD`, color: 'text-foreground' },
              {
                label: 'Combined P&L',
                value: `${(summary?.totalPnl ?? 0) >= 0 ? '+' : ''}${(summary?.totalPnl ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} aUSD`,
                color: (summary?.totalPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
              },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-border rounded-2xl px-6 py-5 transition-spring hover:scale-[1.02]">
                <p className="text-[11px] uppercase tracking-widest text-subtle mb-2">{s.label}</p>
                <p className={`text-[22px] font-light tracking-tight tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Holdings */}
          {holdings.length === 0 ? (
            <div className="py-16 text-center border border-border/50 rounded-2xl bg-card/50">
              <p className="text-subtle text-[14px]">No open positions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-[2.5rem_1fr_7rem_7rem_7rem_9rem] gap-4 px-5 mb-2 text-[11px] uppercase tracking-widest text-subtle">
                <span />
                <span>Token</span>
                <span className="text-right">Value</span>
                <span className="text-right">Avg Entry</span>
                <span className="text-right">Current Price</span>
                <span className="text-right">P&amp;L</span>
              </div>
              <div className="flex flex-col gap-2">
                {holdings.map((holding) => (
                  <PublicHoldingRow key={holding.token} holding={holding} />
                ))}
              </div>
            </div>
          )}

          {/* Agent cards */}
          {agents.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[13px] font-medium text-muted">Agents ({agents.length})</h2>
              <div className="flex flex-col gap-2">
                {agents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/traders/${agent.leader}`}
                    className="bg-surface border border-border hover:border-accent/40 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition-spring hover:scale-[1.005]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar address={agent.leader} size={28} />
                      <div className="min-w-0">
                        <p className="font-mono text-[12px] text-foreground/80 truncate">{fmt(agent.leader)}</p>
                        <p className="text-[10px] text-subtle">{agent.positions.length} position{agent.positions.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 text-[12px] tabular-nums flex-shrink-0">
                      <span className="text-muted">{Number(agent.ausdcLocked).toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD</span>
                      <span className={agent.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {agent.unrealizedPnl >= 0 ? '+' : ''}{agent.unrealizedPnl.toFixed(2)}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        agent.status === 'ACTIVE'
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-foreground/15 text-foreground/40'
                      }`}>
                        {agent.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PublicHoldingRow({ holding }: { holding: Holding }) {
  const pnlColor = holding.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="grid grid-cols-[2.5rem_1fr_7rem_7rem_7rem_9rem] gap-4 items-center px-5 py-4 bg-surface border border-border rounded-2xl">
      <TokenBadge token={holding.token} size={32} />
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-foreground">{holding.token}</p>
        <p className="text-[11px] text-subtle">
          {holding.byAgent.length} agent{holding.byAgent.length !== 1 ? 's' : ''}
        </p>
      </div>
      <span className="text-right text-[13px] text-foreground/90 tabular-nums">
        ${holding.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
      <span className="text-right text-[13px] text-muted tabular-nums">
        ${holding.weightedAvgEntry.toFixed(4)}
      </span>
      <span className="text-right text-[13px] text-muted tabular-nums">
        ${holding.currentPrice.toFixed(4)}
      </span>
      <span className={`text-right text-[13px] tabular-nums ${pnlColor}`}>
        {holding.pnlUsd >= 0 ? '+' : ''}{holding.pnlUsd.toFixed(2)} ({holding.pnlPct >= 0 ? '+' : ''}{holding.pnlPct.toFixed(1)}%)
      </span>
    </div>
  );
}
