'use client';

import { useAccount } from 'wagmi';
import { usePrivy }   from '@privy-io/react-auth';
import { useAUSD }    from '@/hooks/useAUSD';

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COMPARISON_ROWS = [
  { label: 'Chain',  testnet: 'Somnia Shannon · 50312', mainnet: 'Somnia · 5031' },
  { label: 'Token',  testnet: 'aUSD (test)', mainnet: 'USDC / real assets' },
  { label: 'Agents', testnet: 'Demo agents, simulated P&L', mainnet: 'Live copy-trading' },
  { label: 'Gas',    testnet: 'STT (free faucet)', mainnet: 'STT' },
];

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
    <div className="text-foreground px-[7.5%] py-8 w-full select-none">
      <div className="mb-10">
        <h1 className="text-[28px] font-light tracking-[-0.04em] text-foreground mb-1">aUSD Faucet</h1>
        <p className="text-[14px] text-muted font-normal">Claim test tokens to try copy-trading on Somnia Testnet.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left column — about aUSD + testnet/mainnet comparison */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 transition-spring animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <img src="/token-logos/aUSD.svg" alt="aUSD" className="w-9 h-9 rounded-full flex-shrink-0" />
              <div>
                <p className="text-foreground text-[16px] font-light">What is aUSD?</p>
                <p className="text-subtle text-[11px]">Aionis test dollar · 6 decimals</p>
              </div>
            </div>
            <p className="text-[13px] text-muted leading-relaxed font-light">
              aUSD is a faucet-mintable test stablecoin used to back your AI copy-trading agents on Somnia
              Shannon Testnet (chain 50312). When you deploy an agent, your aUSD is locked into a personal,
              non-custodial agent vault contract — the agent uses it to mirror a leader&apos;s trades and
              tracks real, on-chain profit and loss. It carries no real value and exists purely so you can
              test the full Aionis pipeline — discovery, deployment, autonomous execution, and stop-loss —
              before mainnet launch.
            </p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-6 transition-spring animate-fade-in-up">
            <p className="text-[13px] font-medium text-foreground mb-4">Testnet vs Mainnet</p>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-subtle text-[11px] uppercase tracking-wider bg-background/40">
                    <th className="py-3 px-4 font-medium"></th>
                    <th className="py-3 px-4 font-medium">Testnet (now)</th>
                    <th className="py-3 px-4 font-medium">Mainnet (coming)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-[12px]">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.label}>
                      <td className="py-3 px-4 text-subtle font-medium">{row.label}</td>
                      <td className="py-3 px-4 text-foreground/90">{row.testnet}</td>
                      <td className="py-3 px-4 text-foreground/50">{row.mainnet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column — claim card + STT faucet */}
        <div className="lg:col-span-5 space-y-4">
          {/* aUSD claim */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-5 transition-spring animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/token-logos/aUSD.svg" alt="aUSD" className="w-9 h-9 rounded-full flex-shrink-0" />
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
          <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-5 transition-spring animate-fade-in-up">
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
    </div>
  );
}
