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
    <div className="min-h-[calc(100vh-60px)] flex items-start justify-center px-4 pt-24">
      <div className="w-full max-w-sm space-y-4 animate-scale-in">

        <div>
          <h1 className="text-[22px] font-light tracking-tight text-foreground mb-1">Faucet</h1>
          <p className="text-subtle text-[13px]">Claim test tokens to try copy trading on Somnia Testnet.</p>
        </div>

        {/* aUSD */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-5 transition-spring">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent text-[11px] font-semibold">aUSD</span>
              </div>
              <div>
                <p className="text-foreground text-[14px] font-light">aUSD</p>
                <p className="text-subtle text-[11px]">Aionis test dollar · 6 decimals</p>
              </div>
            </div>
            {isConnected && (
              <div className="text-right">
                <p className="text-[10px] text-subtle uppercase tracking-wide mb-0.5">Balance</p>
                <p className="text-foreground font-light tabular-nums text-[14px]">{fmt(balance)}</p>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 pt-5 space-y-3">
            <div className="flex justify-between text-[12px]">
              <span className="text-subtle">Amount per claim</span>
              <span className="text-foreground">10,000 aUSD</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-subtle">Cooldown</span>
              <span className="text-foreground">24 hours</span>
            </div>
            {isConnected && !canFaucet && (
              <div className="flex justify-between text-[12px]">
                <span className="text-subtle">Next claim in</span>
                <span className="text-accent">{cooldownLabel}</span>
              </div>
            )}
          </div>

          {isConnected ? (
            <button
              onClick={() => claimFaucet().catch(() => {})}
              disabled={!canFaucet || faucetPending}
              className={`w-full rounded-full py-3 text-[14px] font-light tracking-wide transition-spring hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:scale-100 ${
                canFaucet && !faucetPending
                  ? 'bg-accent hover:bg-accent-hover text-accent-foreground hover:shadow-md hover:shadow-accent/20'
                  : 'bg-foreground/[0.06] text-foreground/30 cursor-not-allowed'
              }`}>
              {faucetPending ? 'Claiming…' : canFaucet ? 'Claim 10,000 aUSD' : `Available in ${cooldownLabel}`}
            </button>
          ) : (
            <button onClick={login}
              className="w-full rounded-full border border-foreground/[0.18] bg-foreground/[0.03] text-foreground/90 text-[14px] font-light py-3 hover:bg-foreground/[0.08] hover:border-foreground/40 transition-spring hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
              Connect Wallet
            </button>
          )}
        </div>

        {/* STT for gas */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-5 transition-spring">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
              <span className="text-muted text-[11px] font-semibold">STT</span>
            </div>
            <div>
              <p className="text-foreground text-[14px] font-light">STT</p>
              <p className="text-subtle text-[11px]">Somnia Testnet gas token</p>
            </div>
          </div>

          <p className="text-subtle text-[12px] leading-relaxed">
            You need STT to pay for gas on Somnia Testnet (chain 50312). Get it from the official faucet.
          </p>

          <a
            href="https://faucet.somnia.network"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-full border border-border text-muted text-[14px] font-light py-3 hover:border-subtle hover:text-foreground transition-spring hover:scale-[1.02] active:scale-[0.98]">
            Somnia Faucet
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 opacity-60">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>

        <p className="text-subtle text-[11px] text-center">
          Somnia Testnet · Chain 50312 · RPC: dream-rpc.somnia.network
        </p>
      </div>
    </div>
  );
}
