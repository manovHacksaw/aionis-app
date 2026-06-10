'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type ActivityEvent = {
  id:            string;
  type:          'OPENED' | 'CLOSED';
  token:         string;
  ausdAllocated: number;
  entryPrice:    number;
  exitPrice:     number | null;
  pnl:           number | null;
  pnlPct:        number | null;
  leader:        string;
  happenedAt:    string;
  txHash:        string | null;
};

type ActivityData = {
  stats:  { openCount: number; closedCount: number; totalPnl: number; openedToday: number };
  events: ActivityEvent[];
};

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TOKEN_HUES: Record<string, number> = { WSOMI: 32, USDC: 200, NIA: 280, USDT: 150 };
const tokenHue = (token: string) => TOKEN_HUES[token] ?? (token.charCodeAt(0) * 47) % 360;

const TokenBadge = ({ token, size = 36 }: { token: string; size?: number }) => {
  const sym = token.toUpperCase();
  let src = '';
  if (sym === 'WSOMI' || sym === 'SOMI') src = '/token-logos/WSOMI.png';
  else if (sym === 'USDC' || sym === 'USDC.E') src = '/token-logos/USDC.png';
  else if (sym === 'AUSD') src = '/token-logos/aUSD.svg';

  if (src) {
    return (
      <img
        src={src}
        alt={token}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-border bg-surface flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 border border-border/60 bg-gradient-to-br from-surface to-border select-none"
      style={{ width: size, height: size }}
    >
      <svg
        style={{ width: size * 0.55, height: size * 0.55 }}
        className="text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2" />
        <path d="M12 6v12" />
      </svg>
    </div>
  );
};

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

// ── Agent Timeline ─────────────────────────────────────────────────────────────

function AgentTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="bg-surface border border-border/60 rounded-2xl px-6 py-8 text-center">
        <p className="text-subtle text-[13px]">No agent activity recorded yet.</p>
        <p className="text-subtle text-[11px] mt-1">Once your agents start copying trades, their decisions will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {events.map((ev, idx) => {
        const isOpen    = ev.type === 'OPENED';
        const isProfit  = !isOpen && (ev.pnl ?? 0) >= 0;
        const dotColor  = isOpen ? 'bg-accent' : isProfit ? 'bg-emerald-400' : 'bg-red-400';
        const pnlColor  = isProfit ? 'text-emerald-400' : 'text-red-400';

        return (
          <div
            key={ev.id + ev.type}
            className="bg-surface border border-border/60 hover:border-accent/30 rounded-2xl px-4 py-3 flex items-center gap-3 transition-spring hover:scale-[1.005] animate-fade-in-up"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            {/* Status dot */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />

            {/* Token badge */}
            <TokenBadge token={ev.token} size={28} />

            {/* Main text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] text-foreground/90">
                  {isOpen ? 'Opened' : 'Closed'} <span className="font-medium">{ev.token}</span>
                  {isOpen
                    ? ` · ${ev.ausdAllocated.toFixed(2)} aUSD · entry $${ev.entryPrice.toFixed(4)}`
                    : ev.pnl !== null
                      ? ` · ${ev.pnl >= 0 ? '+' : ''}${ev.pnl.toFixed(2)} aUSD`
                      : ''}
                </span>
                {!isOpen && ev.pnlPct !== null && (
                  <span className={`text-[11px] font-mono ${pnlColor}`}>
                    ({ev.pnlPct >= 0 ? '+' : ''}{ev.pnlPct.toFixed(1)}%)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Avatar address={ev.leader} size={14} />
                <span className="text-[11px] text-subtle font-mono">{fmt(ev.leader)}</span>
                <span className="text-[11px] text-subtle/50">·</span>
                <span className="text-[11px] text-subtle">{timeAgo(ev.happenedAt)}</span>
              </div>
            </div>

            {/* Explorer link */}
            {ev.txHash && (
              <a
                href={`https://testnet.somnia.exploreme.pro/tx/${ev.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-subtle hover:text-accent transition-colors flex-shrink-0"
                title="View on Somnia explorer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const { authenticated, user } = usePrivy();
  const isConnected = authenticated && !!user?.wallet?.address;
  const address = user?.wallet?.address;

  const [agents,       setAgents]       = useState<Agent[]>([]);
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [refreshTick,  setRefreshTick]  = useState(0);
  const hasFetched = useRef(false);

  // Clear stale data and reset initial-load flag when address changes
  useEffect(() => {
    hasFetched.current = false;
    setAgents([]);
    setSummary(null);
    setActivityData(null);
    setError(null);
  }, [address]);

  // 30s silent auto-refresh while connected
  useEffect(() => {
    if (!isConnected) return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [isConnected]);

  useEffect(() => {
    if (!address) return;
    if (!hasFetched.current) setLoading(true);
    fetch(`/api/vaults/${address}`)
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.vaults ?? []);
        setSummary(d.summary ?? null);
        hasFetched.current = true;
      })
      .catch(() => { if (!hasFetched.current) setError('Failed to load portfolio.'); })
      .finally(() => setLoading(false));
  }, [address, refreshTick]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/activity/${address}`)
      .then((r) => r.json())
      .then((d) => setActivityData(d))
      .catch(() => {});
  }, [address, refreshTick]);

  const holdings = useMemo(() => aggregateHoldings(agents), [agents]);
  const openPositionCount = holdings.reduce((sum, h) => sum + h.byAgent.reduce((s, a) => s + a.positionCount, 0), 0);
  const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
  const totalPnl   = holdings.reduce((sum, h) => sum + h.pnlUsd, 0);

  const openedToday = activityData?.stats.openedToday ?? null;

  return (
    <div className="text-foreground px-[7.5%] py-8 w-full select-none">
      <div className="mb-10">
        <h1 className="text-[28px] font-light tracking-[-0.04em] text-foreground mb-1">Portfolio</h1>
        <p className="text-[14px] text-muted font-normal">Your token holdings and agent activity, across all agents.</p>
      </div>

      {!isConnected && (
        <div className="py-24 text-center border border-border/50 rounded-2xl flex flex-col items-center gap-4">
          <p className="text-subtle text-[14px]">Connect your wallet to view your portfolio.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && loading && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-surface border border-border/60 rounded-2xl px-6 py-5 animate-shimmer">
                <div className="h-3 bg-surface/50 rounded w-20 mb-3" />
                <div className="h-7 bg-surface/50 rounded w-28" />
              </div>
            ))}
          </div>
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
        <div className="space-y-8">
          <div className="py-16 text-center border border-border/50 rounded-2xl">
            <p className="text-subtle text-[14px] mb-1">No open positions yet.</p>
            <p className="text-subtle text-[13px] mb-8">Deploy an agent and wait for the leader&apos;s next move — your holdings will show up here.</p>
            <button
              onClick={() => router.push('/traders')}
              className="rounded-full border border-foreground/[0.18] bg-foreground/[0.03] text-foreground/90 text-[13px] px-5 py-2 hover:bg-foreground/[0.08] hover:border-foreground/40 transition-spring hover:scale-105 active:scale-95 cursor-pointer"
            >
              Discover Leaders
            </button>
          </div>
          {/* Still show timeline even if no current holdings (past activity) */}
          {activityData && activityData.events.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[13px] font-medium text-muted">Agent Timeline</h2>
                  <p className="text-[11px] text-subtle mt-0.5">Past autonomous decisions by your agents</p>
                </div>
                <span className="text-[10px] text-subtle/50 uppercase tracking-wider">Powered by Somnia AI</span>
              </div>
              <AgentTimeline events={activityData.events} />
            </div>
          )}
        </div>
      )}

      {isConnected && !loading && !error && holdings.length > 0 && (
        <div className="space-y-8">
          {/* Summary row — 4 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Holdings Value',      value: `${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD`, color: 'text-foreground' },
              { label: 'Unrealized P&L',      value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} aUSD`,                   color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Open Positions',      value: `${openPositionCount} across ${summary?.activeCount ?? 0} agents`,           color: 'text-foreground' },
              { label: 'Opened by Agents Today', value: openedToday !== null ? `${openedToday}` : '…', color: 'text-accent' },
            ].map((s, idx) => (
              <div key={s.label} className="bg-surface border border-border rounded-2xl px-6 py-5 transition-spring hover:scale-[1.02] animate-fade-in-up" style={{ animationDelay: `${idx * 40}ms` }}>
                <p className="text-[11px] uppercase tracking-widest text-subtle mb-2">{s.label}</p>
                <p className={`text-[22px] font-light tracking-tight tabular-nums ${s.color}`}>
                  {s.value ?? '…'}
                </p>
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

          {/* Agent Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[13px] font-medium text-muted">Agent Timeline</h2>
                <p className="text-[11px] text-subtle mt-0.5">Autonomous decisions made across all your agents</p>
              </div>
              <span className="text-[10px] text-subtle/50 uppercase tracking-wider">Powered by Somnia AI</span>
            </div>
            <AgentTimeline events={activityData?.events ?? []} />
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
