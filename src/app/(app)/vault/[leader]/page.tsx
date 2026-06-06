'use client';

import * as React from 'react';
import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useAUSD } from '@/hooks/useAUSD';
import { useVault } from '@/hooks/useVault';

const RISK_DESCRIPTIONS: Record<number, string> = {
  1: 'Very conservative · max 5% per trade',
  2: 'Conservative · max 10% per trade',
  3: 'Moderate · max 20% per trade',
  4: 'Aggressive · max 35% per trade',
  5: 'Max risk · up to 50% per trade',
};

const RISK_MAX_PCT: Record<number, number> = { 1: 5, 2: 10, 3: 20, 4: 35, 5: 50 };

type LeaderStats = {
  followerCount: number;
  wsomiPrice:    number;
  stats24h: { trades: number; volume: number; buys: number; sells: number };
  lastSeen: string | null;
};

function fmt(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface PageProps {
  params: Promise<{ leader: string }> | { leader: string };
}

export default function VaultPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const leaderAddress = resolvedParams.leader as `0x${string}`;

  const { address, isConnected } = useAccount();
  const { login } = usePrivy();
  const { balance, canFaucet, cooldownSeconds, faucetPending, claimFaucet } = useAUSD();
  const { createVault, createPending, vaultStatus } = useVault(leaderAddress);

  const [stats,    setStats]    = useState<LeaderStats | null>(null);
  const [statsErr, setStatsErr] = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [amount,   setAmount]   = useState('');
  const [riskLevel, setRiskLevel] = useState(3);
  const [tokens, setTokens] = useState<Record<string, boolean>>({
    WSOMI: true, 'USDC.e': true, WETH: false, WBTC: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState<string | null>(null);

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

  const toggleToken = (token: string) =>
    setTokens((prev) => ({ ...prev, [token]: !prev[token] }));

  const selectedTokens = Object.entries(tokens).filter(([, v]) => v).map(([k]) => k);
  const parsedAmount   = parseFloat(amount) || 0;
  const canSubmit      = parsedAmount > 0 && parsedAmount <= balance && selectedTokens.length > 0 && isConnected;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      await createVault({
        amountHuman:    parsedAmount,
        riskLevel,
        maxPerTradePct: RISK_MAX_PCT[riskLevel],
        tokens:         selectedTokens,
      });
      router.push('/portfolio');
    } catch (err: any) {
      setSubmitErr(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFaucet() {
    try { await claimFaucet(); } catch {}
  }

  const total24h    = (stats?.stats24h.buys ?? 0) + (stats?.stats24h.sells ?? 0);
  const buyPct      = total24h > 0 ? Math.round((stats!.stats24h.buys / total24h) * 100) : 0;
  const vol         = stats?.stats24h.volume ?? 0;
  const volFmt      = vol >= 1000 ? `$${(vol / 1000).toFixed(1)}k` : `$${vol.toFixed(0)}`;

  const cooldownMin = Math.ceil(cooldownSeconds / 60);

  return (
    <div className="min-h-screen text-white px-16 py-8 max-w-[1440px] mx-auto w-full select-none font-sans">
      <div className="mb-8">
        <Link href="/traders" className="text-white/40 hover:text-white text-sm transition-colors flex items-center gap-2 w-fit">
          <span>←</span> Traders
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left: Leader Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wide">Copying Leader</div>
                  <div
                    onClick={handleCopy}
                    className="font-mono text-sm tracking-tight text-white/90 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 relative"
                  >
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
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 border-b border-white/[0.05] pb-6 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">24h Volume</div>
                <div className="text-lg font-light text-white tabular-nums">
                  {statsErr ? '—' : stats ? volFmt : <span className="text-white/20">…</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">24h Trades</div>
                <div className="text-lg font-light text-white tabular-nums">
                  {statsErr ? '—' : stats ? stats.stats24h.trades : <span className="text-white/20">…</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Buy %</div>
                <div className={`text-lg font-light tabular-nums ${!stats ? 'text-white/20' : buyPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {statsErr ? '—' : stats ? `${buyPct}%` : '…'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Followers</div>
                <div className="text-lg font-light text-white tabular-nums">
                  {statsErr ? '—' : stats ? stats.followerCount : <span className="text-white/20">…</span>}
                </div>
              </div>
            </div>

            <p className="text-white/30 text-[11px] leading-relaxed">
              Activity is recorded on Somnia Mainnet. Copying occurs on Somnia Testnet (chain 50312) using aUSD.
            </p>
          </div>

          {/* aUSD Balance card */}
          {isConnected && (
            <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">aUSD Balance</p>
                <p className="text-[17px] font-light tabular-nums text-white">
                  {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-neutral-600 text-[13px] ml-1.5">aUSD</span>
                </p>
              </div>
              <button
                onClick={handleFaucet}
                disabled={!canFaucet || faucetPending}
                className={`rounded-full border text-[12px] px-4 py-1.5 transition-all duration-200 cursor-pointer ${
                  canFaucet && !faucetPending
                    ? 'border-white/[0.18] text-white/80 hover:text-white hover:border-white/30'
                    : 'border-white/[0.07] text-white/30 cursor-not-allowed'
                }`}
              >
                {faucetPending ? 'Claiming…' : canFaucet ? 'Faucet' : `${cooldownMin}m`}
              </button>
            </div>
          )}
        </div>

        {/* Right: Create Vault Form */}
        <div className="lg:col-span-7">
          {vaultStatus === 'ACTIVE' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 mb-4">
              <p className="text-amber-400 text-[13px]">You already have an active vault for this leader.</p>
              <button onClick={() => router.push('/portfolio')} className="text-amber-400/70 text-[12px] hover:text-amber-400 transition-colors mt-1 cursor-pointer">
                View in Portfolio →
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6 space-y-6"
          >
            <div>
              <h2 className="text-[20px] font-light tracking-tight text-white mb-1">Create Vault</h2>
              <p className="text-white/40 text-[12px]">
                Lock aUSD to start copying this trader's moves automatically.
              </p>
            </div>

            {/* aUSD Amount */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[12px] text-white/60">aUSD Amount</label>
                <span className="text-[12px] text-white/30">
                  Available: {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/[0.03] border border-zinc-800 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-white/30 transition-all font-mono"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={() => setAmount(balance > 0 ? balance.toFixed(2) : '')}
                  className="absolute right-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Max
                </button>
              </div>
              {parsedAmount > balance && balance > 0 && (
                <p className="text-[11px] text-red-400">Exceeds your aUSD balance</p>
              )}
            </div>

            {/* Risk Level */}
            <div className="space-y-3">
              <label className="text-[12px] text-white/60 block">Risk Level</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    type="button"
                    key={level}
                    onClick={() => setRiskLevel(level)}
                    className={`flex-1 py-2.5 rounded-xl border text-[13px] font-light transition-all duration-200 cursor-pointer ${
                      riskLevel === level
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-white/[0.03] border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-amber-500/80">{RISK_DESCRIPTIONS[riskLevel]}</p>
            </div>

            {/* Token Allowlist */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[12px] text-white/60 block">Allowed Tokens</label>
                <p className="text-[11px] text-white/30">This vault will only copy trades for selected tokens</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['WSOMI', 'USDC.e', 'WETH', 'WBTC'].map((token) => (
                  <label key={token} className="flex items-center gap-3 cursor-pointer group text-[13px] select-none">
                    <input type="checkbox" checked={tokens[token] || false} onChange={() => toggleToken(token)} className="sr-only" />
                    <div className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                      tokens[token]
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                        : 'border-white/10 bg-white/[0.02] group-hover:border-white/30 text-transparent'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-white/70 group-hover:text-white transition-colors">{token}</span>
                  </label>
                ))}
              </div>
              {selectedTokens.length === 0 && (
                <p className="text-[11px] text-red-400">Select at least one token</p>
              )}
            </div>

            {/* Error */}
            {submitErr && (
              <p className="text-[12px] text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 break-all">
                {submitErr}
              </p>
            )}

            {/* Submit */}
            {isConnected ? (
              <button
                type="submit"
                disabled={!canSubmit || submitting || createPending}
                className={`w-full rounded-full py-3 text-[14px] font-light tracking-wide transition-all duration-200 cursor-pointer ${
                  canSubmit && !submitting && !createPending
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                {submitting || createPending ? 'Confirm in wallet…' : 'Create Vault'}
              </button>
            ) : (
              <button
                type="button"
                onClick={login}
                className="w-full rounded-full border border-white/[0.18] bg-white/[0.03] text-white/90 text-[14px] font-light py-3 hover:bg-white/[0.08] hover:border-white/40 transition-all duration-300 cursor-pointer"
              >
                Connect Wallet
              </button>
            )}

            <p className="text-[10px] text-white/20 text-center leading-normal">
              aUSD is locked in a smart contract on Somnia Testnet (chain 50312). A keeper will execute copy trades on your behalf.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
