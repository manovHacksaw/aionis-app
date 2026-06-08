'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import ConnectButton from '@/components/ConnectButton';
import Avatar from '@/components/Avatar';

type Position = {
  id:             string;
  token:          string;
  tokenAddress:   string;
  ausdcAllocated: number;
  entryPrice:     number;
  currentPrice:   number;
  unrealizedPnl:  number;
  status:         string;
  openedAt:       string;
  leader:         string;
};

type Agent = {
  id:            string;
  leader:        string;
  ausdcLocked:   number;
  riskLevel:     number;
  status:        string;
  unrealizedPnl: number;
  positions:     Position[];
};

type Summary = { totalLocked: number; totalPnl: number; activeCount: number };

type AgentBreakdown = { leader: string; allocated: number; pnl: number; positionCount: number };

type Holding = {
  token:            string;
  tokenAddress:     string;
  totalAllocated:   number;
  totalValue:       number;
  weightedAvgEntry: number;
  currentPrice:     number;
  pnlUsd:           number;
  pnlPct:           number;
  byAgent:          AgentBreakdown[];
};

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const TOKEN_HUES: Record<string, number> = { WSOMI: 32, USDC: 200, NIA: 280, USDT: 150 };
const tokenHue = (token: string) => TOKEN_HUES[token] ?? (token.charCodeAt(0) * 47) % 360;

const TokenBadge = ({ token, size = 36 }: { token: string; size?: number }) => (
  <div
    className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-black"
    style={{
      width: size, height: size,
      backgroundColor: `hsl(${tokenHue(token)}, 70%, 60%)`,
      fontSize: size * 0.36,
    }}
  >
    {token.slice(0, 1)}
  </div>
);

function aggregateHoldings(agents: Agent[]): Holding[] {
  const byToken = new Map<string, Position[]>();
  for (const agent of agents) {
    for (const pos of agent.positions) {
      if (!byToken.has(pos.token)) byToken.set(pos.token, []);
      byToken.get(pos.token)!.push(pos);
    }
  }

  return Array.from(byToken.entries()).map(([token, positions]) => {
    const totalAllocated = positions.reduce((sum, p) => sum + p.ausdcAllocated, 0);
    const weightedAvgEntry = totalAllocated > 0
      ? positions.reduce((sum, p) => sum + p.ausdcAllocated * p.entryPrice, 0) / totalAllocated
      : 0;
    const currentPrice = positions[0]?.currentPrice ?? 0;
    const pnlUsd = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const pnlPct = totalAllocated > 0 ? (pnlUsd / totalAllocated) * 100 : 0;

    const byLeader = new Map<string, Position[]>();
    for (const p of positions) {
      if (!byLeader.has(p.leader)) byLeader.set(p.leader, []);
      byLeader.get(p.leader)!.push(p);
    }
    const byAgent: AgentBreakdown[] = Array.from(byLeader.entries())
      .map(([leader, ps]) => ({
        leader,
        allocated:     ps.reduce((sum, p) => sum + p.ausdcAllocated, 0),
        pnl:           ps.reduce((sum, p) => sum + p.unrealizedPnl, 0),
        positionCount: ps.length,
      }))
      .sort((a, b) => b.allocated - a.allocated);

    return {
      token,
      tokenAddress: positions[0]?.tokenAddress ?? '',
      totalAllocated,
      totalValue: totalAllocated + pnlUsd,
      weightedAvgEntry,
      currentPrice,
      pnlUsd,
      pnlPct,
      byAgent,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
}

export default function PortfolioPage() {
  const router = useRouter();
  const { authenticated, user } = usePrivy();
  const isConnected = authenticated && !!user?.wallet?.address;
  const address = user?.wallet?.address;
  const [agents,  setAgents]  = useState<Agent[]>([]);
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
        setAgents(d.vaults ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => setError('Failed to load portfolio.'))
      .finally(() => setLoading(false));
  }, [address]);

  const holdings = useMemo(() => aggregateHoldings(agents), [agents]);
  const openPositionCount = holdings.reduce((sum, h) => sum + h.byAgent.reduce((s, a) => s + a.positionCount, 0), 0);
  const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
  const totalPnl   = holdings.reduce((sum, h) => sum + h.pnlUsd, 0);

  return (
    <div className="text-foreground px-[7.5%] py-8 w-full select-none">
      <div className="mb-10">
        <h1 className="text-[28px] font-light tracking-[-0.04em] text-foreground mb-1">Portfolio</h1>
        <p className="text-[14px] text-muted font-normal">Your token holdings, aggregated across all agents.</p>
      </div>

      {!isConnected && (
        <div className="py-24 text-center border border-border/50 rounded-2xl flex flex-col items-center gap-4">
          <p className="text-subtle text-[14px]">Connect your wallet to view your portfolio.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && loading && (
        <div className="space-y-8 animate-fade-in">
          {/* Skeleton summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface border border-border/60 rounded-2xl px-6 py-5 animate-shimmer">
                <div className="h-3 bg-surface/50 rounded w-20 mb-3" />
                <div className="h-7 bg-surface/50 rounded w-28" />
              </div>
            ))}
          </div>

          {/* Skeleton holdings list */}
          <div>
            <div className="h-3 bg-surface/40 rounded w-24 mb-4 animate-shimmer" />
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-surface border border-border/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 animate-shimmer"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center gap-3 min-w-[160px]">
                    <div className="w-9 h-9 rounded-full bg-surface/50 flex-shrink-0" />
                    <div className="space-y-2">
                      <div className="h-4 bg-surface/50 rounded w-16" />
                      <div className="h-3 bg-surface/50 rounded w-20" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-6 flex-grow max-w-md">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="space-y-2">
                        <div className="h-3 bg-surface/50 rounded w-12" />
                        <div className="h-4 bg-surface/50 rounded w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isConnected && !loading && error && (
        <div className="py-24 text-center text-red-500/60 text-[14px]">{error}</div>
      )}

      {isConnected && !loading && !error && holdings.length === 0 && (
        <div className="py-24 text-center border border-border/50 rounded-2xl">
          <p className="text-subtle text-[14px] mb-1">No open positions yet.</p>
          <p className="text-subtle text-[13px] mb-8">Deploy an agent and wait for the leader&apos;s next move — your holdings will show up here.</p>
          <button
            onClick={() => router.push('/traders')}
            className="rounded-full border border-foreground/[0.18] bg-foreground/[0.03] text-foreground/90 text-[13px] px-5 py-2 hover:bg-foreground/[0.08] hover:border-foreground/40 transition-spring hover:scale-105 active:scale-95 cursor-pointer"
          >
            Discover Leaders
          </button>
        </div>
      )}

      {isConnected && !loading && !error && holdings.length > 0 && (
        <div className="space-y-8">
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Holdings Value',   value: `${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD`, color: 'text-foreground' },
              { label: 'Unrealized P&L',   value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} aUSD`, color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Open Positions',   value: `${openPositionCount} across ${summary?.activeCount ?? 0} agents`, color: 'text-foreground' },
            ].map((s, idx) => (
              <div key={s.label} className="bg-surface border border-border rounded-2xl px-6 py-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-spring hover:scale-[1.02] animate-fade-in-up" style={{ animationDelay: `${idx * 40}ms` }}>
                <p className="text-[11px] uppercase tracking-widest text-subtle mb-2">{s.label}</p>
                <p className={`text-[22px] font-light tracking-tight tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Holdings list */}
          <div>
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
                <HoldingCard key={holding.token} holding={holding} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Holding card ──────────────────────────────────────────────────────────────

function HoldingCard({ holding }: { holding: Holding }) {
  const [expanded, setExpanded] = useState(false);
  const pnlColor = holding.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="bg-surface border border-border hover:border-accent/40 rounded-2xl transition-spring hover:scale-[1.01] hover:shadow-md hover:shadow-accent/5 animate-fade-in-up">
      <div
        onClick={() => setExpanded((v) => !v)}
        className="grid grid-cols-[2.5rem_1fr_7rem_7rem_7rem_9rem] gap-4 items-center px-5 py-4 cursor-pointer"
      >
        <TokenBadge token={holding.token} size={32} />

        <div className="min-w-0">
          <p className="text-[14px] font-medium text-foreground">{holding.token}</p>
          <p className="text-[11px] text-subtle">
            {holding.byAgent.length} agent{holding.byAgent.length !== 1 ? 's' : ''} · {holding.byAgent.reduce((s, a) => s + a.positionCount, 0)} position{holding.byAgent.reduce((s, a) => s + a.positionCount, 0) !== 1 ? 's' : ''}
          </p>
        </div>

        <span className="text-right text-[13px] text-foreground/90 tabular-nums">
          {holding.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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

      {expanded && (
        <div className="border-t border-border/80 px-5 py-3 space-y-2 animate-fade-in-up">
          <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Held via</p>
          {holding.byAgent.map((a) => (
            <div key={a.leader} className="flex items-center justify-between gap-4 py-1.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar address={a.leader} size={22} />
                <a
                  href={`https://explorer.somnia.network/address/${a.leader}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[12px] text-foreground/80 hover:text-accent hover:underline decoration-accent/50 transition-colors truncate"
                >
                  {fmt(a.leader)}
                </a>
                <span className="text-[10px] text-subtle">
                  {a.positionCount} position{a.positionCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-5 text-[12px] tabular-nums flex-shrink-0">
                <span className="text-muted">{a.allocated.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD</span>
                <span className={a.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {a.pnl >= 0 ? '+' : ''}{a.pnl.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
