'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import ConnectButton from '@/components/ConnectButton';
import Avatar from '@/components/Avatar';
import { useVault } from '@/hooks/useVault';

type Agent = {
  id:            string;
  leader:        string;
  ausdcLocked:   number;
  riskLevel:     number;
  status:        string;
  unrealizedPnl: number;
};

type Summary = { totalLocked: number; totalPnl: number; activeCount: number };

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const RiskDots = ({ level }: { level: number }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((d) => (
      <div key={d} className={`w-1.5 h-1.5 rounded-full ${d <= level ? 'bg-accent' : 'bg-foreground/10'}`} />
    ))}
  </div>
);

export default function AgentsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
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
      .catch(() => setError('Failed to load agents.'))
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <div className="text-foreground px-[7.5%] py-8 w-full select-none">
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-light tracking-[-0.04em] text-foreground mb-1">Agents</h1>
          <p className="text-[14px] text-muted font-normal">Your deployed copy-trading agents — monitor and control them from here.</p>
        </div>
        <button
          onClick={() => router.push('/traders')}
          className="rounded-full border border-foreground/[0.18] bg-foreground/[0.03] text-foreground/90 text-[13px] px-5 py-2 hover:bg-foreground/[0.08] hover:border-foreground/40 transition-spring hover:scale-105 active:scale-95 cursor-pointer self-start md:self-auto"
        >
          Deploy New Agent
        </button>
      </div>

      {!isConnected && (
        <div className="py-24 text-center border border-border/50 rounded-2xl flex flex-col items-center gap-4">
          <p className="text-subtle text-[14px]">Connect your wallet to view your agents.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && loading && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface border border-border/60 rounded-2xl px-6 py-5 animate-shimmer">
                <div className="h-3 bg-surface/50 rounded w-20 mb-3" />
                <div className="h-7 bg-surface/50 rounded w-28" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-surface border border-border/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 animate-shimmer"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-3 min-w-[180px]">
                  <div className="w-8 h-8 rounded-full bg-surface/50 flex-shrink-0" />
                  <div className="space-y-2">
                    <div className="h-4 bg-surface/50 rounded w-20" />
                    <div className="h-3 bg-surface/50 rounded w-10" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 flex-grow max-w-sm">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-3 bg-surface/50 rounded w-10" />
                      <div className="h-4 bg-surface/50 rounded w-14" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-4 rounded bg-surface/50" />
                  <div className="w-20 h-8 rounded-full bg-surface/50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isConnected && !loading && error && (
        <div className="py-24 text-center text-red-500/60 text-[14px]">{error}</div>
      )}

      {isConnected && !loading && !error && agents.length === 0 && (
        <div className="py-24 text-center border border-border/50 rounded-2xl">
          <p className="text-subtle text-[14px] mb-1">No agents deployed yet.</p>
          <p className="text-subtle text-[13px] mb-8">Pick a leader to deploy your first copy-trading agent.</p>
          <button
            onClick={() => router.push('/traders')}
            className="rounded-full border border-foreground/[0.18] bg-foreground/[0.03] text-foreground/90 text-[13px] px-5 py-2 hover:bg-foreground/[0.08] hover:border-foreground/40 transition-all duration-300 cursor-pointer"
          >
            Discover Leaders
          </button>
        </div>
      )}

      {isConnected && !loading && !error && agents.length > 0 && summary && (
        <div className="space-y-8">
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Locked Capital', value: `${summary.totalLocked.toLocaleString()} aUSD`, color: 'text-foreground' },
              { label: 'Unrealized P&L',       value: `${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(2)} aUSD`, color: summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Active Agents',        value: `${summary.activeCount} / ${agents.length}`, color: 'text-foreground' },
            ].map((s, idx) => (
              <div key={s.label} className="bg-surface border border-border rounded-2xl px-6 py-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-spring hover:scale-[1.02] animate-fade-in-up" style={{ animationDelay: `${idx * 40}ms` }}>
                <p className="text-[11px] uppercase tracking-widest text-subtle mb-2">{s.label}</p>
                <p className={`text-[22px] font-light tracking-tight tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Agent list */}
          <div>
            <p className="text-[11px] uppercase tracking-widest text-subtle mb-4">Your Agents</p>
            <div className="flex flex-col gap-2">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: Agent }) {
  const router = useRouter();
  const { vaultStatus, pauseVault, resumeVault } = useVault(agent.leader as `0x${string}`);
  const [toggling,  setToggling]  = useState(false);
  const [toggleErr, setToggleErr] = useState<string | null>(null);

  // Prefer the live on-chain status; fall back to the API snapshot until it resolves
  const status = vaultStatus ?? agent.status;

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setToggling(true);
    setToggleErr(null);
    try {
      if (status === 'ACTIVE') await pauseVault();
      else await resumeVault();
    } catch (err: any) {
      setToggleErr(err?.shortMessage ?? err?.message ?? 'Failed');
    }
    setToggling(false);
  }

  return (
    <div
      onClick={() => router.push(`/traders/${agent.leader}/manage`)}
      className="bg-surface border border-border hover:border-accent/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-spring hover:scale-[1.015] active:scale-99 hover:shadow-md hover:shadow-accent/5 cursor-pointer animate-fade-in-up"
    >
      <div className="flex items-center gap-3 min-w-[180px]">
        <Avatar address={agent.leader} size={32} />
        <div>
          <a
            href={`https://explorer.somnia.network/address/${agent.leader}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[13px] text-foreground/90 hover:text-accent hover:underline decoration-accent/50 transition-colors block"
          >
            {fmt(agent.leader)}
          </a>
          <p className="text-[10px] text-subtle uppercase tracking-wide mt-0.5">Following</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 flex-grow max-w-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Locked</p>
          <p className="text-[13px] text-foreground/80 tabular-nums">{agent.ausdcLocked} aUSD</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">P&L</p>
          <p className={`text-[13px] tabular-nums ${agent.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {agent.unrealizedPnl >= 0 ? '+' : ''}{agent.unrealizedPnl.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Risk</p>
          <RiskDots level={agent.riskLevel} />
        </div>
      </div>

      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 min-w-[64px]">
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-accent'}`} />
          <span className={`text-[12px] ${status === 'ACTIVE' ? 'text-emerald-400' : 'text-accent'}`}>
            {status}
          </span>
        </div>

        {toggleErr && <span className="text-[11px] text-red-400 max-w-[140px] truncate" title={toggleErr}>{toggleErr}</span>}

        {status !== 'CLOSED' && (
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`rounded-full border text-[12px] px-4 py-1.5 transition-spring hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:scale-100 ${
              status === 'ACTIVE'
                ? 'border-accent/40 text-accent hover:border-accent/70'
                : 'border-emerald-500/40 text-emerald-400 hover:border-emerald-500/70'
            }`}
          >
            {toggling ? '…' : status === 'ACTIVE' ? 'Pause' : 'Resume'}
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/traders/${agent.leader}/manage`); }}
          className="rounded-full border border-foreground/[0.15] text-foreground/80 text-[12px] px-4 py-1.5 hover:text-foreground hover:border-foreground/30 transition-spring hover:scale-105 active:scale-95 cursor-pointer"
        >
          Manage
        </button>
      </div>
    </div>
  );
}
