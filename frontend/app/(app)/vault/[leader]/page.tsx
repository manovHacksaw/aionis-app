'use client';

import * as React from 'react';
import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useAUSD } from '@/hooks/useAUSD';
import { useVault } from '@/hooks/useVault';
import { MAINNET_TOKENS } from '@/config/tokens';

const RISK_DESCRIPTIONS: Record<number, string> = {
  1: 'Very conservative · max 5% per trade',
  2: 'Conservative · max 10% per trade',
  3: 'Moderate · max 20% per trade',
  4: 'Aggressive · max 35% per trade',
  5: 'Max risk · up to 50% per trade',
};
const RISK_MAX_PCT: Record<number, number> = { 1: 5, 2: 10, 3: 20, 4: 35, 5: 50 };

const AVAILABLE_TOKENS = [
  { symbol: 'WSOMI',  address: MAINNET_TOKENS['WSOMI']  as `0x${string}` },
  { symbol: 'USDC.e', address: MAINNET_TOKENS['USDC.e'] as `0x${string}` },
  { symbol: 'NIA',    address: MAINNET_TOKENS['NIA']    as `0x${string}` },
  { symbol: 'USDT',   address: MAINNET_TOKENS['USDT']   as `0x${string}` },
];

type LeaderStats = {
  followerCount: number;
  wsomiPrice:    number;
  stats24h: { trades: number; volume: number; buys: number; sells: number };
  lastSeen: string | null;
};

function fmt(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }
function fmtAUSD(n: number | null) {
  if (n === null) return '…';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PageProps {
  params: Promise<{ leader: string }> | { leader: string };
}

// ── Manage panel ──────────────────────────────────────────────────────────────

function ManageVault({ leaderAddress }: { leaderAddress: `0x${string}` }) {
  const router = useRouter();
  const { balance, canFaucet, cooldownSeconds, faucetPending, claimFaucet } = useAUSD();
  const {
    vaultStatus, lockedBalance, freeBalance, unrealizedPnL,
    openPositionIds, keeperSet,
    depositPending, withdrawPending, closePending,
    deposit, withdraw, closePosition, pauseVault, resumeVault, setKeeperManually,
  } = useVault(leaderAddress);

  const [depositAmt,  setDepositAmt]  = useState('');
  const [depositErr,  setDepositErr]  = useState<string | null>(null);
  const [withdrawErr, setWithdrawErr] = useState<string | null>(null);
  const [keeperErr,   setKeeperErr]   = useState<string | null>(null);
  const [closingId,   setClosingId]   = useState<string | null>(null);
  const [toggling,    setToggling]    = useState(false);

  const parsedDeposit = parseFloat(depositAmt) || 0;
  const cooldownH     = Math.floor(cooldownSeconds / 3600);
  const cooldownM     = Math.ceil((cooldownSeconds % 3600) / 60);
  const cooldownLabel = cooldownH > 0 ? `${cooldownH}h ${cooldownM}m` : `${cooldownM}m`;
  const pnlColor      = unrealizedPnL === null ? 'text-white'
    : unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400';

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedDeposit <= 0) return;
    setDepositErr(null);
    try { await deposit(parsedDeposit); setDepositAmt(''); }
    catch (err: any) { setDepositErr(err?.shortMessage ?? err?.message ?? 'Deposit failed'); }
  }

  async function handleWithdraw() {
    setWithdrawErr(null);
    try { await withdraw(); }
    catch (err: any) { setWithdrawErr(err?.shortMessage ?? err?.message ?? 'Withdraw failed'); }
  }

  async function handleTogglePause() {
    setToggling(true);
    try {
      if (vaultStatus === 'ACTIVE') await pauseVault();
      else await resumeVault();
    } catch {}
    setToggling(false);
  }

  async function handleClose(posId: `0x${string}`) {
    setClosingId(posId);
    try { await closePosition(posId); } catch {}
    setClosingId(null);
  }

  async function handleSetKeeper() {
    setKeeperErr(null);
    try { await setKeeperManually(); }
    catch (err: any) { setKeeperErr(err?.shortMessage ?? err?.message ?? 'Failed'); }
  }

  return (
    <div className="lg:col-span-7 space-y-4">

      {/* Status + toggle */}
      <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${vaultStatus === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className={`text-[13px] font-medium ${vaultStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {vaultStatus}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/portfolio')}
            className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
            ← Portfolio
          </button>
          <button onClick={handleTogglePause} disabled={toggling}
            className={`rounded-full border text-[12px] px-4 py-1.5 transition-all cursor-pointer disabled:opacity-40 ${
              vaultStatus === 'ACTIVE'
                ? 'border-amber-500/40 text-amber-400 hover:border-amber-500/70'
                : 'border-emerald-500/40 text-emerald-400 hover:border-emerald-500/70'
            }`}>
            {toggling ? '…' : vaultStatus === 'ACTIVE' ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>

      {/* Keeper notice */}
      {!keeperSet && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-4">
          <p className="text-amber-400 text-[13px] mb-1 font-medium">Keeper not authorized</p>
          <p className="text-amber-400/60 text-[11px] mb-3">
            Authorize the Aionis keeper to execute copy trades on your behalf. Without this, trades will not copy automatically.
          </p>
          {keeperErr && <p className="text-red-400 text-[11px] mb-2">{keeperErr}</p>}
          <button onClick={handleSetKeeper}
            className="rounded-full bg-amber-500 hover:bg-amber-400 text-black text-[12px] font-semibold px-4 py-1.5 transition-colors cursor-pointer">
            Authorize Keeper
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-5 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Locked',   value: `${fmtAUSD(lockedBalance)} aUSD`,  color: 'text-white' },
          { label: 'Free Balance',   value: `${fmtAUSD(freeBalance)} aUSD`,    color: 'text-white' },
          { label: 'Unrealized P&L', value: `${unrealizedPnL !== null && unrealizedPnL >= 0 ? '+' : ''}${fmtAUSD(unrealizedPnL)} aUSD`, color: pnlColor },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">{label}</p>
            <p className={`text-[16px] font-light tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Deposit */}
      <form onSubmit={handleDeposit} className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-[13px] text-white font-light">Deposit more aUSD</p>
          <span className="text-[11px] text-zinc-600">Available: {fmtAUSD(balance)} aUSD</span>
        </div>
        <div className="relative flex items-center">
          <input type="number" min="0" step="any" value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            className="w-full bg-white/[0.03] border border-zinc-800 rounded-xl px-4 py-2.5 text-[13px] text-white focus:outline-none focus:border-white/30 transition-all font-mono"
            placeholder="0.00" />
          <button type="button" onClick={() => setDepositAmt(balance > 0 ? balance.toFixed(2) : '')}
            className="absolute right-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
            Max
          </button>
        </div>
        {depositErr && <p className="text-[11px] text-red-400">{depositErr}</p>}
        <button type="submit"
          disabled={parsedDeposit <= 0 || parsedDeposit > balance || depositPending}
          className="w-full rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white text-[13px] py-2.5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
          {depositPending ? 'Confirm in wallet…' : 'Deposit'}
        </button>
      </form>

      {/* Withdraw */}
      <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-white font-light mb-0.5">Withdraw aUSD</p>
          <p className="text-[11px] text-zinc-600">
            {(openPositionIds?.length ?? 0) > 0
              ? 'Close all positions first'
              : `Free balance: ${fmtAUSD(freeBalance)} aUSD`}
          </p>
          {withdrawErr && <p className="text-[11px] text-red-400 mt-1">{withdrawErr}</p>}
        </div>
        <button onClick={handleWithdraw}
          disabled={(openPositionIds?.length ?? 0) > 0 || (freeBalance ?? 0) <= 0 || withdrawPending}
          className="rounded-full border border-white/[0.18] text-white/80 text-[12px] px-5 py-2 hover:text-white hover:border-white/30 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
          {withdrawPending ? 'Confirm…' : 'Withdraw All'}
        </button>
      </div>

      {/* Open positions */}
      {(openPositionIds?.length ?? 0) > 0 && (
        <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-600">
            Open Positions ({openPositionIds!.length})
          </p>
          <div className="flex flex-col gap-2">
            {openPositionIds!.map((posId) => (
              <div key={posId} className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                <span className="font-mono text-[11px] text-zinc-400">{fmt(posId)}</span>
                <button onClick={() => handleClose(posId)}
                  disabled={closingId === posId || closePending}
                  className="rounded-full border border-red-500/30 text-red-400 text-[11px] px-3 py-1 hover:border-red-500/60 transition-all cursor-pointer disabled:opacity-40">
                  {closingId === posId ? '…' : 'Close'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Faucet */}
      <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">aUSD Balance</p>
          <p className="text-[15px] font-light tabular-nums text-white">
            {fmtAUSD(balance)} <span className="text-zinc-600 text-[12px]">aUSD</span>
          </p>
        </div>
        <button onClick={() => claimFaucet().catch(() => {})} disabled={!canFaucet || faucetPending}
          className="rounded-full border text-[12px] px-4 py-1.5 transition-all cursor-pointer border-white/[0.18] text-white/80 hover:text-white hover:border-white/30 disabled:border-white/[0.07] disabled:text-white/30 disabled:cursor-not-allowed">
          {faucetPending ? 'Claiming…' : canFaucet ? 'Faucet' : cooldownLabel}
        </button>
      </div>
    </div>
  );
}

// ── Create vault form ─────────────────────────────────────────────────────────

function CreateVault({ leaderAddress }: { leaderAddress: `0x${string}` }) {
  const router = useRouter();
  const { login } = usePrivy();
  const { isConnected } = useAccount();
  const { balance, canFaucet, cooldownSeconds, faucetPending, claimFaucet } = useAUSD();
  const { createVault, createPending } = useVault(leaderAddress);

  const [selected, setSelected] = useState<Record<string, boolean>>({
    [MAINNET_TOKENS['WSOMI']]:  true,
    [MAINNET_TOKENS['USDC.e']]: true,
    [MAINNET_TOKENS['NIA']]:    false,
    [MAINNET_TOKENS['USDT']]:   false,
  });
  const [amount,     setAmount]     = useState('');
  const [riskLevel,  setRiskLevel]  = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState<string | null>(null);

  const cooldownH      = Math.floor(cooldownSeconds / 3600);
  const cooldownM      = Math.ceil((cooldownSeconds % 3600) / 60);
  const cooldownLabel  = cooldownH > 0 ? `${cooldownH}h ${cooldownM}m` : `${cooldownM}m`;
  const parsedAmount   = parseFloat(amount) || 0;
  const selectedTokens = Object.entries(selected).filter(([, v]) => v).map(([k]) => k as `0x${string}`);
  const canSubmit      = parsedAmount > 0 && parsedAmount <= balance && selectedTokens.length > 0 && isConnected;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      await createVault({ amountHuman: parsedAmount, riskLevel, maxPerTradePct: RISK_MAX_PCT[riskLevel], tokens: selectedTokens });
      router.push('/portfolio');
    } catch (err: any) {
      setSubmitErr(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="lg:col-span-7 space-y-4">
      {isConnected && (
        <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">aUSD Balance</p>
            <p className="text-[17px] font-light tabular-nums text-white">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="text-neutral-600 text-[13px] ml-1.5">aUSD</span>
            </p>
          </div>
          <button onClick={() => claimFaucet().catch(() => {})} disabled={!canFaucet || faucetPending}
            className={`rounded-full border text-[12px] px-4 py-1.5 transition-all cursor-pointer ${
              canFaucet && !faucetPending
                ? 'border-white/[0.18] text-white/80 hover:text-white hover:border-white/30'
                : 'border-white/[0.07] text-white/30 cursor-not-allowed'
            }`}>
            {faucetPending ? 'Claiming…' : canFaucet ? 'Faucet' : cooldownLabel}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-[20px] font-light tracking-tight text-white mb-1">Create Vault</h2>
          <p className="text-white/40 text-[12px]">Lock aUSD to start copying this trader&apos;s moves automatically.</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[12px] text-white/60">aUSD Amount</label>
            <span className="text-[12px] text-white/30">
              Available: {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD
            </span>
          </div>
          <div className="relative flex items-center">
            <input type="number" min="0" step="any" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white/[0.03] border border-zinc-800 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-white/30 transition-all font-mono"
              placeholder="0.00" />
            <button type="button" onClick={() => setAmount(balance > 0 ? balance.toFixed(2) : '')}
              className="absolute right-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
              Max
            </button>
          </div>
          {parsedAmount > balance && balance > 0 && (
            <p className="text-[11px] text-red-400">Exceeds your aUSD balance</p>
          )}
        </div>

        <div className="space-y-3">
          <label className="text-[12px] text-white/60 block">Risk Level</label>
          <div className="flex gap-2">
            {[1,2,3,4,5].map((level) => (
              <button type="button" key={level} onClick={() => setRiskLevel(level)}
                className={`flex-1 py-2.5 rounded-xl border text-[13px] font-light transition-all cursor-pointer ${
                  riskLevel === level
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-white/[0.03] border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                }`}>
                {level}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-amber-500/80">{RISK_DESCRIPTIONS[riskLevel]}</p>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[12px] text-white/60 block">Allowed Tokens</label>
            <p className="text-[11px] text-white/30">Only copy trades for selected tokens</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_TOKENS.map(({ symbol, address }) => (
              <label key={address} className="flex items-center gap-3 cursor-pointer group text-[13px] select-none">
                <input type="checkbox" checked={!!selected[address]}
                  onChange={() => setSelected(prev => ({ ...prev, [address]: !prev[address] }))}
                  className="sr-only" />
                <div className={`w-[18px] h-[18px] rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  selected[address]
                    ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                    : 'border-white/10 bg-white/[0.02] group-hover:border-white/30 text-transparent'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-white/70 group-hover:text-white transition-colors">{symbol}</span>
              </label>
            ))}
          </div>
          {selectedTokens.length === 0 && <p className="text-[11px] text-red-400">Select at least one token</p>}
        </div>

        {submitErr && (
          <p className="text-[12px] text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 break-all">
            {submitErr}
          </p>
        )}

        {isConnected ? (
          <button type="submit" disabled={!canSubmit || submitting || createPending}
            className={`w-full rounded-full py-3 text-[14px] font-light tracking-wide transition-all cursor-pointer ${
              canSubmit && !submitting && !createPending
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}>
            {submitting || createPending ? 'Confirm in wallet…' : 'Create Vault'}
          </button>
        ) : (
          <button type="button" onClick={login}
            className="w-full rounded-full border border-white/[0.18] bg-white/[0.03] text-white/90 text-[14px] font-light py-3 hover:bg-white/[0.08] hover:border-white/40 transition-all cursor-pointer">
            Connect Wallet
          </button>
        )}

        <p className="text-[10px] text-white/20 text-center leading-normal">
          aUSD is locked in a smart contract on Somnia Testnet (chain 50312). A keeper will execute copy trades on your behalf.
        </p>
      </form>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VaultPage({ params }: PageProps) {
  const resolvedParams  = params instanceof Promise ? use(params) : params;
  const leaderAddress   = resolvedParams.leader as `0x${string}`;
  const { isConnected } = useAccount();
  const { vaultStatus, lockedBalance } = useVault(leaderAddress);

  const [stats,    setStats]    = useState<LeaderStats | null>(null);
  const [statsErr, setStatsErr] = useState(false);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    fetch(`/api/traders/${leaderAddress}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStatsErr(true));
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
  const isManaging = (vaultStatus === 'ACTIVE' || vaultStatus === 'PAUSED') && (lockedBalance ?? 0) > 0;

  return (
    <div className="text-white px-16 py-8 max-w-[1440px] mx-auto w-full select-none"
      style={{ fontFamily: 'var(--font-geist-sans, system-ui)' }}>
      <div className="mb-8">
        <Link href="/traders" className="text-white/40 hover:text-white text-sm transition-colors flex items-center gap-2 w-fit">
          <span>←</span> Traders
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left: leader info */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wide">Copying Leader</div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  <div onClick={handleCopy}
                    className="font-mono text-sm tracking-tight text-white/90 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 relative">
                    <span>{fmt(leaderAddress)}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 text-white/40">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.25 2.25 0 0 0-1.75 3.364M18.75 7.5V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V7.5M18.75 7.5V5.25A2.25 2.25 0 0 0 16.5 3h-9A2.25 2.25 0 0 0 5.25 5.25V7.5m13.5 0h-13.5" />
                    </svg>
                    {copied && (
                      <span className="absolute -top-8 left-0 bg-amber-600 text-white text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded z-50">
                        Copied!
                      </span>
                    )}
                  </div>
                  <a
                    href={`https://explorer.somnia.network/address/${leaderAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/40 hover:text-amber-400 transition-colors flex items-center"
                    title="View on Explorer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-white/[0.05] pb-6 mb-4">
              {[
                {
                  label: '24h Volume',
                  value: statsErr ? '—' : stats ? volFmt : (
                    <div className="h-6 w-16 bg-zinc-800/40 rounded animate-pulse mt-0.5" />
                  )
                },
                {
                  label: '24h Trades',
                  value: statsErr ? '—' : stats ? String(stats.stats24h.trades) : (
                    <div className="h-6 w-10 bg-zinc-800/40 rounded animate-pulse mt-0.5" />
                  )
                },
                {
                  label: 'Buy %',
                  value: statsErr ? '—' : stats ? `${buyPct}%` : (
                    <div className="h-6 w-12 bg-zinc-800/40 rounded animate-pulse mt-0.5" />
                  ),
                  color: !stats ? '' : buyPct >= 50 ? 'text-emerald-400' : 'text-red-400'
                },
                {
                  label: 'Followers',
                  value: statsErr ? '—' : stats ? String(stats.followerCount) : (
                    <div className="h-6 w-8 bg-zinc-800/40 rounded animate-pulse mt-0.5" />
                  )
                },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
                  <div className={`text-lg font-light tabular-nums ${color ?? 'text-white'}`}>{value}</div>
                </div>
              ))}
            </div>

            <p className="text-white/30 text-[11px] leading-relaxed">
              Activity recorded on Somnia Mainnet. Copying occurs on Somnia Testnet (chain 50312) using aUSD.
            </p>
          </div>
        </div>

        {/* Right: manage or create */}
        {isConnected && isManaging
          ? <ManageVault leaderAddress={leaderAddress} />
          : <CreateVault leaderAddress={leaderAddress} />
        }
      </div>
    </div>
  );
}
