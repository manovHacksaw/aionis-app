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
import Avatar from '@/components/Avatar';

const RISK_DESCRIPTIONS: Record<number, string> = {
  1: 'Very conservative · max 5% per trade',
  2: 'Conservative · max 10% per trade',
  3: 'Moderate · max 20% per trade',
  4: 'Aggressive · max 35% per trade',
  5: 'Max risk · up to 50% per trade',
};
const RISK_MAX_PCT: Record<number, number> = { 1: 5, 2: 10, 3: 20, 4: 35, 5: 50 };

const TokenLogo = ({ symbol }: { symbol: string }) => {
  const sym = symbol.toUpperCase();
  let src = '';
  if (sym === 'WSOMI' || sym === 'SOMI') src = '/token-logos/WSOMI.png';
  else if (sym === 'USDC.E' || sym === 'USDC') src = '/token-logos/USDC.png';
  else if (sym === 'AUSD') src = '/token-logos/aUSD.svg';
  else if (sym === 'USDT') src = '/token-logos/USDT.svg';

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

const AVAILABLE_TOKENS = [
  { symbol: 'WSOMI',  address: MAINNET_TOKENS['WSOMI']  as `0x${string}` },
  { symbol: 'USDC.e', address: MAINNET_TOKENS['USDC']   as `0x${string}` },
  { symbol: 'NIA',    address: MAINNET_TOKENS['NIA']    as `0x${string}` },
  { symbol: 'USDT',   address: MAINNET_TOKENS['USDT']   as `0x${string}` },
];

type LeaderStats = {
  followerCount: number;
  wsomiPrice:    number;
  stats24h: { trades: number; volume: number; buys: number; sells: number };
  lastSeen: string | null;
  totalProfitYielded?: number;
  recentSwaps?: any[];
};

function fmt(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

interface PageProps {
  params: Promise<{ address: string }> | { address: string };
}

// ── Deploy Agent Form ─────────────────────────────────────────────────────────

function CreateAgent({ leaderAddress }: { leaderAddress: `0x${string}` }) {
  const router = useRouter();
  const { login } = usePrivy();
  const { address, isConnected } = useAccount();
  const { balance, canFaucet, cooldownSeconds, faucetPending, claimFaucet, hasEnoughAllowance } = useAUSD();
  const { createVault: createAgent, reopenVault: reopenAgent, vaultStatus, keeperSet, createPending } = useVault(leaderAddress);
  const isReopen = vaultStatus === 'CLOSED';

  const [selected, setSelected] = useState<Record<string, boolean>>({
    [MAINNET_TOKENS['WSOMI']]:  true,
    [MAINNET_TOKENS['USDC']]:   true,
    [MAINNET_TOKENS['NIA']]:    false,
    [MAINNET_TOKENS['USDT']]:   false,
  });
  const [amount,     setAmount]     = useState('');
  const [riskLevel,  setRiskLevel]  = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Advanced Trade Limits — empty USD inputs map to 0 ("no limit") on submit
  const [showAdvanced,    setShowAdvanced]    = useState(false);
  const [slippagePct,     setSlippagePct]     = useState('1');
  const [minLeaderTrade,  setMinLeaderTrade]  = useState('');
  const [maxLeaderTrade,  setMaxLeaderTrade]  = useState('');
  const [minAlloc,        setMinAlloc]        = useState('');
  const [maxAlloc,        setMaxAlloc]        = useState('');
  const [stopLossPct,     setStopLossPct]     = useState(20);

  const cooldownH      = Math.floor(cooldownSeconds / 3600);
  const cooldownM      = Math.ceil((cooldownSeconds % 3600) / 60);
  const cooldownLabel  = cooldownH > 0 ? `${cooldownH}h ${cooldownM}m` : `${cooldownM}m`;
  const parsedAmount   = parseFloat(amount) || 0;
  const selectedTokens = Object.entries(selected).filter(([, v]) => v).map(([k]) => k as `0x${string}`);

  const parsedSlippagePct    = parseFloat(slippagePct) || 0;
  const slippageBps          = Math.round(parsedSlippagePct * 100);
  const parsedMinLeaderTrade = parseFloat(minLeaderTrade) || 0;
  const parsedMaxLeaderTrade = parseFloat(maxLeaderTrade) || 0;
  const parsedMinAlloc       = parseFloat(minAlloc) || 0;
  const parsedMaxAlloc       = parseFloat(maxAlloc) || 0;

  const slippageValid         = slippageBps >= 10 && slippageBps <= 2000;
  const leaderTradeRangeValid = !(parsedMinLeaderTrade > 0 && parsedMaxLeaderTrade > 0 && parsedMinLeaderTrade > parsedMaxLeaderTrade);
  const allocRangeValid       = !(parsedMinAlloc > 0 && parsedMaxAlloc > 0 && parsedMinAlloc > parsedMaxAlloc);
  const limitsValid           = slippageValid && leaderTradeRangeValid && allocRangeValid;

  const canSubmit = parsedAmount > 0 && parsedAmount <= balance && selectedTokens.length > 0 && isConnected && limitsValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitErr(null);
    setShowConfirm(true);
  }

  async function handleConfirmDeploy() {
    setShowConfirm(false);
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const deployFn = isReopen ? reopenAgent : createAgent;
      await deployFn({
        amountHuman:    parsedAmount,
        riskLevel,
        maxPerTradePct: RISK_MAX_PCT[riskLevel],
        tokens:         selectedTokens,
        limits: {
          slippageBps,
          minLeaderTradeUsd: parsedMinLeaderTrade,
          maxLeaderTradeUsd: parsedMaxLeaderTrade,
          minAllocUsd:       parsedMinAlloc,
          maxAllocUsd:       parsedMaxAlloc,
          stopLossPct,
        },
      });
      router.push('/portfolio');
    } catch (err: any) {
      setSubmitErr(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {isConnected && (
        <div className="bg-card border border-border/80 rounded-2xl px-5 py-4 flex items-center justify-between transition-spring animate-scale-in">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">aUSD Balance</p>
            <p className="text-[17px] font-light tabular-nums text-foreground">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="text-subtle text-[13px] ml-1.5">aUSD</span>
            </p>
          </div>
          <button onClick={() => claimFaucet().catch(() => {})} disabled={!canFaucet || faucetPending}
            className={`rounded-full border text-[12px] px-4 py-1.5 transition-spring hover:scale-105 active:scale-95 cursor-pointer disabled:scale-100 ${
              canFaucet && !faucetPending
                ? 'border-foreground/[0.18] text-foreground/80 hover:text-foreground hover:border-foreground/30'
                : 'border-foreground/[0.07] text-foreground/30 cursor-not-allowed'
            }`}>
            {faucetPending ? 'Claiming…' : canFaucet ? 'Faucet' : cooldownLabel}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border/80 rounded-2xl p-6 space-y-6 animate-fade-in-up">
        <div>
          <h2 className="text-[20px] font-light tracking-tight text-foreground mb-1">Deploy AI Agent</h2>
          <p className="text-foreground/40 text-[12px]">Configure your agent&apos;s parameters — it will operate autonomously on Somnia from the moment you deploy.</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[12px] text-foreground/60">aUSD Amount</label>
            <span className="text-[12px] text-foreground/30">
              Available: {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD
            </span>
          </div>
          <div className="relative flex items-center">
            <input type="number" min="0" step="any" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-border rounded-xl px-4 py-3 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all font-mono"
              placeholder="0.00" />
            <button type="button" onClick={() => setAmount(balance > 0 ? balance.toFixed(2) : '')}
              className="absolute right-3 bg-foreground/10 hover:bg-foreground/20 text-foreground text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg transition-spring hover:scale-105 active:scale-95 cursor-pointer">
              Max
            </button>
          </div>
          {parsedAmount > balance && balance > 0 && (
            <p className="text-[11px] text-red-400">Exceeds your aUSD balance</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[12px] text-foreground/60 block">Risk Level</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map((level) => (
                <button type="button" key={level} onClick={() => setRiskLevel(level)}
                  className={`flex-1 py-2.5 rounded-xl border text-[13px] font-light transition-spring hover:scale-105 active:scale-95 cursor-pointer ${
                    riskLevel === level
                      ? 'bg-accent/20 border-accent/50 text-accent'
                      : 'bg-foreground/[0.03] border-foreground/10 text-foreground/50 hover:border-foreground/20 hover:text-foreground'
                  }`}>
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-accent/80">{RISK_DESCRIPTIONS[riskLevel]}</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[12px] text-foreground/60">Stop-Loss — Max Loss %</label>
              <span className="text-[12px] text-foreground/30 font-mono">{stopLossPct}%</span>
            </div>
            <input type="range" min="5" max="50" step="5" value={stopLossPct}
              onChange={(e) => setStopLossPct(parseInt(e.target.value))}
              className="w-full accent-accent cursor-pointer" />
            <p className="text-[11px] text-foreground/30">Auto-close a position when its drawdown exceeds this threshold. Your agent acts autonomously to limit losses.</p>
          </div>
        </div>

        <div className="border border-foreground/10 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-[12px] text-foreground/60 hover:text-foreground transition-colors cursor-pointer">
            <span className="flex items-center gap-2">
              Advanced Trade Limits
              <span className="text-[10px] text-foreground/30">(optional)</span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="px-4 pb-4 space-y-5 border-t border-foreground/[0.06] pt-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[12px] text-foreground/60">Slippage Tolerance</label>
                  <span className="text-[12px] text-foreground/30 font-mono">{parsedSlippagePct.toFixed(1)}%</span>
                </div>
                <input type="range" min="0.1" max="20" step="0.1" value={slippagePct}
                  onChange={(e) => setSlippagePct(e.target.value)}
                  className="w-full accent-accent cursor-pointer" />
                <p className="text-[11px] text-foreground/30">Skip a copy if the price has drifted more than this from the leader&apos;s entry price.</p>
                {!slippageValid && <p className="text-[11px] text-red-400">Must be between 0.1% and 20%</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[12px] text-foreground/60 block">Leader Trade Size Filter</label>
                <p className="text-[11px] text-foreground/30">Ignore the leader&apos;s trades outside this USD range — leave blank for no limit.</p>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="0" step="any" value={minLeaderTrade}
                    onChange={(e) => setMinLeaderTrade(e.target.value)}
                    placeholder="Min $"
                    className="bg-foreground/[0.03] border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all font-mono" />
                  <input type="number" min="0" step="any" value={maxLeaderTrade}
                    onChange={(e) => setMaxLeaderTrade(e.target.value)}
                    placeholder="Max $"
                    className="bg-foreground/[0.03] border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all font-mono" />
                </div>
                {!leaderTradeRangeValid && <p className="text-[11px] text-red-400">Min must be less than or equal to max</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[12px] text-foreground/60 block">Allocation Cap</label>
                <p className="text-[11px] text-foreground/30">Floor/ceiling on how much aUSD your agent commits per copied trade — leave blank for no limit.</p>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="0" step="any" value={minAlloc}
                    onChange={(e) => setMinAlloc(e.target.value)}
                    placeholder="Min aUSD"
                    className="bg-foreground/[0.03] border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all font-mono" />
                  <input type="number" min="0" step="any" value={maxAlloc}
                    onChange={(e) => setMaxAlloc(e.target.value)}
                    placeholder="Max aUSD"
                    className="bg-foreground/[0.03] border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-foreground/30 transition-all font-mono" />
                </div>
                {!allocRangeValid && <p className="text-[11px] text-red-400">Min must be less than or equal to max</p>}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[12px] text-foreground/60 block">Allowed Tokens</label>
            <p className="text-[11px] text-foreground/30">Only copy trades for selected tokens</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_TOKENS.map(({ symbol, address }) => (
              <label key={address} className="flex items-center gap-3 cursor-pointer group text-[13px] select-none">
                <input type="checkbox" checked={!!selected[address]}
                  onChange={() => setSelected(prev => ({ ...prev, [address]: !prev[address] }))}
                  className="sr-only" />
                <div className={`w-[18px] h-[18px] rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  selected[address]
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-foreground/10 bg-foreground/[0.02] group-hover:border-foreground/30 text-transparent'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <TokenLogo symbol={symbol} />
                  <span className="text-foreground/70 group-hover:text-foreground transition-colors">{symbol}</span>
                </div>
              </label>
            ))}
          </div>
          {selectedTokens.length === 0 && <p className="text-[11px] text-red-400">Select at least one token</p>}
        </div>

        {/* Agent preview — what this agent will actually do */}
        <div className="bg-foreground/[0.02] border border-foreground/[0.06] rounded-xl px-4 py-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-foreground/30 mb-3">Your agent will</p>
          {[
            {
              icon: '◉',
              text: `Watch ${leaderAddress.slice(0, 6)}…${leaderAddress.slice(-4)} continuously on Somnia`,
            },
            {
              icon: '⬡',
              text: `Score each detected trade using the Strategist AI model`,
            },
            {
              icon: '◈',
              text: selectedTokens.length > 0
                ? `Only copy ${AVAILABLE_TOKENS.filter(t => selectedTokens.includes(t.address)).map(t => t.symbol).join(', ')} trades`
                : `Copy trades — select at least one token`,
              muted: selectedTokens.length === 0,
            },
            {
              icon: '◇',
              text: `Commit up to ${RISK_MAX_PCT[riskLevel]}% of capital per trade (Risk ${riskLevel} · ${['', 'Very conservative', 'Conservative', 'Moderate', 'Aggressive', 'Max risk'][riskLevel]})`,
            },
            {
              icon: '⬕',
              text: `Auto-close any position that loses more than ${stopLossPct}% (stop-loss)`,
            },
            {
              icon: '◌',
              text: `Operate 24/7 via keeper delegation — no wallet interaction needed`,
            },
          ].map(({ icon, text, muted }) => (
            <div key={text} className={`flex items-start gap-2.5 text-[12px] ${muted ? 'text-red-400/70' : 'text-foreground/50'}`}>
              <span className="flex-shrink-0 mt-0.5 text-[10px] text-foreground/20">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {submitErr && (
          <p className="text-[12px] text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 break-all">
            {submitErr}
          </p>
        )}

        {isConnected ? (
          <button type="submit" disabled={!canSubmit || submitting || createPending}
            className={`w-full rounded-full py-3 text-[14px] font-light tracking-wide transition-spring hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100 ${
              canSubmit && !submitting && !createPending
                ? 'bg-accent text-accent-foreground hover:bg-accent-hover'
                : 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
            }`}>
            {submitting || createPending ? 'Confirm in wallet…' : isReopen ? 'Redeploy Agent' : 'Deploy Agent'}
          </button>
        ) : (
          <button type="button" onClick={login}
            className="w-full rounded-full border border-foreground/[0.18] bg-foreground/[0.03] text-foreground/90 text-[14px] font-light py-3 hover:bg-foreground/[0.08] hover:border-foreground/40 transition-spring hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
            Connect Wallet
          </button>
        )}

        <p className="text-[10px] text-foreground/20 text-center leading-normal">
          Your capital is non-custodial. aUSD is locked in your personal agent contract on Somnia (chain 50312). The keeper is authorized only to open and close positions — it cannot withdraw your funds.
        </p>
      </form>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-card border border-border/80 rounded-2xl p-6 w-full max-w-md space-y-5 animate-scale-in">
            {(() => {
              const needsApprove = !hasEnoughAllowance(parsedAmount);
              const needsKeeper  = !keeperSet;
              const steps: { title: string; desc: string }[] = [];
              if (needsApprove) {
                steps.push({
                  title: 'Approve aUSD',
                  desc: `Allow the vault contract to pull up to ${parsedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD from your wallet.`,
                });
              }
              steps.push({
                title: isReopen ? 'Reopen Agent Vault' : 'Create Agent Vault',
                desc: isReopen
                  ? `Reopens your previously closed vault, locks ${parsedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD, and saves your updated strategy settings on-chain.`
                  : `Deploys your personal vault contract, locks ${parsedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} aUSD, and saves your strategy settings on-chain.`,
              });
              if (needsKeeper) {
                steps.push({
                  title: 'Authorize Keeper',
                  desc: 'Grants the automated keeper permission to open and close trades for this vault on your behalf — it cannot withdraw funds.',
                });
              }

              return (
                <>
                  <div>
                    <h3 className="text-[17px] font-light tracking-tight text-foreground mb-1">
                      {isReopen ? 'Confirm Redeployment' : 'Confirm Deployment'}
                    </h3>
                    <p className="text-[12px] text-foreground/40">
                      {isReopen ? 'Redeploying' : 'Deploying'} this agent requires {steps.length} transaction{steps.length === 1 ? '' : 's'} from your wallet — approve each in sequence.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {steps.map((step, i) => (
                      <div key={step.title} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-foreground/[0.06] border border-foreground/10 flex items-center justify-center text-[11px] text-foreground/60 flex-shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-[13px] text-foreground/90">{step.title}</p>
                          <p className="text-[11px] text-foreground/40">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-full border border-foreground/[0.18] text-foreground/70 text-[13px] font-light py-2.5 hover:bg-foreground/[0.05] hover:text-foreground transition-spring hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmDeploy}
                className="flex-1 rounded-full bg-accent text-accent-foreground text-[13px] font-light py-2.5 hover:bg-accent-hover transition-spring hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
                {isReopen ? 'Confirm & Redeploy' : 'Confirm & Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeployAgentPage({ params }: PageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const leaderAddress  = resolvedParams.address as `0x${string}`;

  const [stats,    setStats]    = useState<LeaderStats | null>(null);
  const [statsErr, setStatsErr] = useState(false);

  useEffect(() => {
    if (!leaderAddress) return;
    fetch(`/api/traders/${leaderAddress}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStatsErr(true));
  }, [leaderAddress]);

  const total24h  = (stats?.stats24h.buys ?? 0) + (stats?.stats24h.sells ?? 0);
  const buyPct    = total24h > 0 ? Math.round((stats!.stats24h.buys / total24h) * 100) : 0;
  const vol       = stats?.stats24h.volume ?? 0;
  const volFmt    = vol >= 1000 ? `$${(vol / 1000).toFixed(1)}k` : `$${vol.toFixed(0)}`;
  const profitYielded = stats?.totalProfitYielded ?? 0;
  const profitFmt     = `${profitYielded >= 0 ? '+' : ''}${profitYielded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} aUSD`;

  return (
    <div className="text-foreground px-[7.5%] py-8 w-full select-none">
      <div className="mb-8">
        <Link href={`/traders/${leaderAddress}`} className="text-foreground/40 hover:text-foreground text-sm transition-spring hover:scale-105 active:scale-95 flex items-center gap-2 w-fit">
          <span>←</span> Back to Trader Profile
        </Link>
      </div>

      {/* Top: Leader summary — full width */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 mb-8 transition-spring animate-scale-in">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-3 lg:flex-shrink-0">
            <Avatar address={leaderAddress} size={36} />
            <div>
              <div className="text-[10px] text-foreground/30 uppercase tracking-wide">Copying Leader</div>
              <div className="font-mono text-sm tracking-tight text-foreground/90 mt-0.5">
                {fmt(leaderAddress)}
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-px self-stretch bg-foreground/[0.06]" />

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 flex-1">
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
                label: 'Total Profits Copy-Traded',
                value: statsErr ? '—' : stats ? profitFmt : (
                  <div className="h-6 w-24 bg-surface/40 rounded animate-shimmer mt-0.5" />
                ),
                color: !stats ? '' : profitYielded >= 0 ? 'text-emerald-400' : 'text-red-400',
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">{label}</div>
                <div className={`text-md font-light tabular-nums ${color ?? 'text-foreground'}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Below: Deploy Agent form — full width */}
      <CreateAgent leaderAddress={leaderAddress} />
    </div>
  );
}
