// src/app/(app)/vault/[leader]/page.tsx
'use client';

import * as React from 'react';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const MOCK_TRADERS = [
  { address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", roi: 42.3, winRate: 68, trades: 134, volume: 28400 },
  { address: "0x1Db3439a222C519ab44bb1144fC28167b4Fa6EE6", roi: -8.1, winRate: 44, trades: 89, volume: 12100 },
  { address: "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c", roi: 91.7, winRate: 74, trades: 201, volume: 67300 },
  { address: "0x14723A09ACff6D2A60DcdF7aA4AFf308FDDC160C", roi: 19.2, winRate: 61, trades: 57, volume: 9800 },
];

const RISK_DESCRIPTIONS = {
  1: "Very conservative · max 5% per trade",
  2: "Conservative · max 10% per trade",
  3: "Moderate · max 20% per trade",
  4: "Aggressive · max 35% per trade",
  5: "Max risk · up to 50% per trade",
};

interface PageProps {
  params: Promise<{ leader: string }> | { leader: string };
}

export default function VaultPage({ params }: PageProps) {
  const router = useRouter();

  // Unwrap params depending on whether it's a Promise (Next 15+) or plain object
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const leaderAddress = resolvedParams.leader;

  // Find trader data or fallback
  const trader = MOCK_TRADERS.find(
    (t) => t.address.toLowerCase() === leaderAddress.toLowerCase()
  ) || { address: leaderAddress, roi: 0, winRate: 0, trades: 0, volume: 0 };

  // UI state
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState<string>('0');
  const [riskLevel, setRiskLevel] = useState<number>(3);
  const [allowedTokens, setAllowedTokens] = useState<Record<string, boolean>>({
    WSOMI: true,
    'USDC.e': true,
    WETH: false,
    WBTC: false,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(leaderAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMax = () => {
    setAmount('10000');
  };

  const toggleToken = (token: string) => {
    setAllowedTokens((prev) => ({
      ...prev,
      [token]: !prev[token],
    }));
  };

  const anyTokenSelected = Object.values(allowedTokens).some(Boolean);
  const parsedAmount = parseFloat(amount) || 0;
  const isSubmitDisabled = parsedAmount <= 0 || !anyTokenSelected;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    alert(`Vault created successfully for leader ${formatAddress(leaderAddress)} with ${parsedAmount} aUSD!`);
    router.push('/portfolio');
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-16 py-12 max-w-6xl mx-auto w-full select-none">
      {/* Back to Traders Link */}
      <div className="mb-8">
        <Link
          href="/traders"
          className="text-white/40 hover:text-white text-sm transition-colors flex items-center gap-2 w-fit"
        >
          <span>←</span> Traders
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Leader Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 relative">
            {/* Copy address badge */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_12px_rgba(217,119,6,0.15)] flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wide">Copying Leader</div>
                  <div
                    onClick={handleCopy}
                    className="font-mono text-sm tracking-tight text-white/90 hover:text-white transition-colors cursor-pointer relative flex items-center gap-1.5"
                  >
                    <span>{formatAddress(leaderAddress)}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="w-4 h-4 text-white/40"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.25 2.25 0 0 0-1.75 3.364M18.75 7.5V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V7.5M18.75 7.5V5.25A2.25 2.25 0 0 0 16.5 3h-9A2.25 2.25 0 0 0 5.25 5.25V7.5m13.5 0h-13.5"
                      />
                    </svg>

                    {copied && (
                      <span className="absolute -top-9 left-1/2 transform -translate-x-1/2 bg-[#d97706] text-white text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded shadow-lg z-50">
                        Copied!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 mb-6 border-b border-white/[0.05] pb-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">30d ROI</div>
                <div className={`text-xl font-medium ${trader.roi >= 0 ? 'text-[#d97706]' : 'text-[#ef4444]'}`}>
                  {trader.roi >= 0 ? '+' : ''}{trader.roi}%
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Win Rate</div>
                <div className="text-xl font-medium text-white">{trader.winRate}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Trades</div>
                <div className="text-xl font-medium text-white">{trader.trades}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Copied Volume</div>
                <div className="text-xl font-medium text-white font-mono">${trader.volume.toLocaleString()}</div>
              </div>
            </div>

            {/* Muted Leader Note */}
            <p className="text-white/40 text-xs leading-relaxed">
              This leader is selected based on transaction history and consistency on QuickSwap. Active copying utilizes low-latency mirroring scripts on the Somnia Testnet.
            </p>
          </div>
        </div>

        {/* Right: Create Vault Panel */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 space-y-6"
          >
            <div>
              <h2 className="text-xl font-medium text-white mb-1">Create Vault</h2>
              <p className="text-white/40 text-xs">
                Lock aUSD to start copying this trader's moves automatically.
              </p>
            </div>

            {/* Field 1: aUSD Amount */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-white/60">aUSD Amount</label>
                <span className="text-xs text-white/30">Available: 10,000 aUSD</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-all font-mono"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={handleMax}
                  className="absolute right-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Field 2: Risk Level */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-white/60 block">Risk Level</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => {
                  const isSelected = riskLevel === level;
                  return (
                    <button
                      type="button"
                      key={level}
                      onClick={() => setRiskLevel(level)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-[#d97706]/20 border-[#d97706]/50 text-amber-400'
                          : 'bg-white/[0.03] border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#d97706] tracking-wide mt-1">
                {RISK_DESCRIPTIONS[riskLevel as keyof typeof RISK_DESCRIPTIONS]}
              </p>
            </div>

            {/* Field 3: Token Allowlist */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-medium text-white/60 block">Allowed Tokens</label>
                <p className="text-[10px] text-white/30">
                  Select which tokens this vault will copy trades for
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {['WSOMI', 'USDC.e', 'WETH', 'WBTC'].map((token) => (
                  <label
                    key={token}
                    className="flex items-center gap-3 cursor-pointer group text-sm select-none"
                  >
                    <input
                      type="checkbox"
                      checked={allowedTokens[token] || false}
                      onChange={() => toggleToken(token)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                        allowedTokens[token]
                          ? 'border-[#d97706] bg-[#d97706]/10 text-[#d97706]'
                          : 'border-white/10 bg-white/[0.02] group-hover:border-white/30 text-transparent'
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="w-3.5 h-3.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-white/80 group-hover:text-white transition-colors">
                      {token}
                    </span>
                  </label>
                ))}
              </div>

              {!anyTokenSelected && (
                <p className="text-[11px] text-[#ef4444] mt-1">
                  Select at least one token
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className={`w-full bg-white hover:bg-neutral-200 text-black font-semibold text-sm rounded-full py-3 transition-colors duration-200 cursor-pointer ${
                  isSubmitDisabled ? 'opacity-40 cursor-not-allowed hover:bg-white' : ''
                }`}
              >
                Create Vault
              </button>
            </div>

            <p className="text-[10px] text-white/30 text-center leading-normal">
              Your aUSD will be locked in a smart contract on Somnia Testnet (chain 50312).
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
