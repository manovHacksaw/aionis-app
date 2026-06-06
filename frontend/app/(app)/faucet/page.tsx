'use client';

import { useAccount } from 'wagmi';
import { usePrivy }   from '@privy-io/react-auth';
import { useAUSD }    from '@/hooks/useAUSD';
import ConnectButton  from '@/components/ConnectButton';

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FaucetPage() {
  const { isConnected } = useAccount();
  const { login }       = usePrivy();
  const {
    balance, canFaucet, cooldownSeconds, faucetPending, claimFaucet,
  } = useAUSD();

  const cooldownH = Math.floor(cooldownSeconds / 3600);
  const cooldownM = Math.ceil((cooldownSeconds % 3600) / 60);
  const cooldownLabel = cooldownH > 0 ? `${cooldownH}h ${cooldownM}m` : `${cooldownM}m`;

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-start justify-center px-4 pt-24"
      style={{ fontFamily: 'var(--font-geist-sans, system-ui)' }}>
      <div className="w-full max-w-sm space-y-4">

        <div>
          <h1 className="text-[22px] font-light tracking-tight text-white mb-1">Faucet</h1>
          <p className="text-zinc-500 text-[13px]">Claim test tokens to try copy trading on Somnia Testnet.</p>
        </div>

        {/* aUSD */}
        <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-[11px] font-semibold">aUSD</span>
              </div>
              <div>
                <p className="text-white text-[14px] font-light">aUSD</p>
                <p className="text-zinc-600 text-[11px]">Aionis test dollar · 6 decimals</p>
              </div>
            </div>
            {isConnected && (
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">Balance</p>
                <p className="text-white font-light tabular-nums text-[14px]">{fmt(balance)}</p>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800/60 pt-5 space-y-3">
            <div className="flex justify-between text-[12px]">
              <span className="text-zinc-500">Amount per claim</span>
              <span className="text-white">10,000 aUSD</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-zinc-500">Cooldown</span>
              <span className="text-white">24 hours</span>
            </div>
            {isConnected && !canFaucet && (
              <div className="flex justify-between text-[12px]">
                <span className="text-zinc-500">Next claim in</span>
                <span className="text-amber-400">{cooldownLabel}</span>
              </div>
            )}
          </div>

          {isConnected ? (
            <button
              onClick={() => claimFaucet().catch(() => {})}
              disabled={!canFaucet || faucetPending}
              className={`w-full rounded-full py-3 text-[14px] font-light tracking-wide transition-all cursor-pointer ${
                canFaucet && !faucetPending
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-white/[0.06] text-white/30 cursor-not-allowed'
              }`}>
              {faucetPending ? 'Claiming…' : canFaucet ? 'Claim 10,000 aUSD' : `Available in ${cooldownLabel}`}
            </button>
          ) : (
            <button onClick={login}
              className="w-full rounded-full border border-white/[0.18] bg-white/[0.03] text-white/90 text-[14px] font-light py-3 hover:bg-white/[0.08] hover:border-white/40 transition-all cursor-pointer">
              Connect Wallet
            </button>
          )}
        </div>

        {/* STT for gas */}
        <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
              <span className="text-zinc-300 text-[11px] font-semibold">STT</span>
            </div>
            <div>
              <p className="text-white text-[14px] font-light">STT</p>
              <p className="text-zinc-600 text-[11px]">Somnia Testnet gas token</p>
            </div>
          </div>

          <p className="text-zinc-500 text-[12px] leading-relaxed">
            You need STT to pay for gas on Somnia Testnet (chain 50312). Get it from the official faucet.
          </p>

          <a
            href="https://faucet.somnia.network"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-full border border-zinc-700 text-zinc-300 text-[14px] font-light py-3 hover:border-zinc-500 hover:text-white transition-all">
            Somnia Faucet
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 opacity-60">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>

        <p className="text-zinc-700 text-[11px] text-center">
          Somnia Testnet · Chain 50312 · RPC: dream-rpc.somnia.network
        </p>
      </div>
    </div>
  );
}
