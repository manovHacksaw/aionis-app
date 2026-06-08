"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import ConnectButton from "@/components/ConnectButton";
import AppNavbar from "@/components/AppNavbar";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useAUSD } from "@/hooks/useAUSD";
import Avatar from "@/components/Avatar";

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ points, color = "#e8b848" }: { points: [number, number][]; color?: string }) {
  const w = 110, h = 44;
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const px = (x: number) => ((x - minX) / (maxX - minX || 1)) * w;
  const py = (y: number) => h - 4 - ((y - minY) / (maxY - minY || 1)) * (h - 8);
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ");
  const fd = `${d} L${px(xs[xs.length - 1]).toFixed(1)},${h} L${px(xs[0]).toFixed(1)},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={fd} fill={`${color}18`} />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" pathLength="1" className="animate-draw-path" />
    </svg>
  );
}

const SPARK1: [number, number][] = [[0,20],[10,22],[20,18],[30,25],[40,20],[50,28],[60,24],[70,30],[80,26],[90,32],[100,28]];
const SPARK2: [number, number][] = [[0,30],[10,26],[20,28],[30,22],[40,25],[50,20],[60,22],[70,18],[80,20],[90,16],[100,18]];

// ── Main area chart ───────────────────────────────────────────────────────────

function MainChart() {
  const W = 700, H = 200;
  const pad = { t: 12, r: 72, b: 36, l: 4 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const pts: [number, number][] = [[0,42],[8,38],[16,35],[24,30],[32,32],[40,28],[48,25],[56,30],[64,42],[72,55],[80,58],[88,56],[96,54],[104,55],[112,53],[120,52],[128,51],[136,50],[144,49],[148,50]];
  const minX = 0, maxX = 148, minY = 22, maxY = 62;
  const px = (x: number) => pad.l + ((x - minX) / (maxX - minX)) * cw;
  const py = (y: number) => pad.t + ch - ((y - minY) / (maxY - minY)) * ch;
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ");
  const fd = `${d} L${px(maxX).toFixed(1)},${(pad.t + ch).toFixed(1)} L${px(minX).toFixed(1)},${(pad.t + ch).toFixed(1)} Z`;
  const yVs = [80, 70, 60, 50];
  const yLs = ["$80.0M", "$70.0M", "$60.0M", "$50.0M"];
  const xLs = ["17 Feb","24 Feb","3 Mar","10 Mar","17 Mar","24 Mar","31 Mar","7 Apr","14 Apr","21 Apr","28 Apr","5 May","12 May"];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8b848" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#e8b848" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yVs.map((yv, i) => (
        <g key={yv}>
          <line x1={pad.l} y1={py(yv)} x2={W - pad.r} y2={py(yv)} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 3" />
          <text x={W - pad.r + 6} y={py(yv) + 4} fill="var(--subtle)" fontSize="10">{yLs[i]}</text>
        </g>
      ))}
      <path d={fd} fill="url(#cg)" />
      <path d={d} stroke="#e8b848" strokeWidth="2" fill="none" strokeLinejoin="round" pathLength="1" className="animate-draw-path" />
      {xLs.map((l, i) => (
        <text key={l} x={pad.l + (i / (xLs.length - 1)) * cw} y={H - 6} fill="var(--subtle)" fontSize="9.5" textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
}

function RateChart() {
  const W = 500, H = 110;
  const pts: [number,number][] = [[0,5.4],[40,5.2],[80,5.0],[120,4.8],[160,5.1],[200,5.3],[240,5.6],[280,5.8],[320,5.5],[360,5.4],[400,5.6],[440,5.9],[480,6.1],[500,6.19]];
  const minY = 4.4, maxY = 7.6;
  const py = (y: number) => H - 18 - ((y - minY) / (maxY - minY)) * (H - 28);
  const px = (x: number) => 4 + (x / 500) * (W - 58);
  const d = pts.map(([x,y],i) => `${i===0?"M":"L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ");
  const fd = `${d} L${px(500).toFixed(1)},${H-18} L${px(0).toFixed(1)},${H-18} Z`;
  const avg = px(pts[1][0]);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8b848" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#e8b848" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[7.5,5.0,2.5].map((yv,i) => (
        <g key={yv}>
          <line x1={4} y1={py(yv)} x2={W-54} y2={py(yv)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={W-50} y={py(yv)+4} fill="var(--subtle)" fontSize="9">{["7.50%","5.00%","2.50%"][i]}</text>
        </g>
      ))}
      <path d={fd} fill="url(#rg)" />
      <path d={d} stroke="#e8b848" strokeWidth="1.5" fill="none" strokeLinejoin="round" pathLength="1" className="animate-draw-path" />
      <text x={avg} y={py(5.4) - 4} fill="var(--muted)" fontSize="9">Avg 5.94%</text>
    </svg>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer ${active ? "bg-accent text-accent-foreground" : "text-subtle hover:text-foreground"}`}>
      {label}
    </button>
  );
}

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-subtle flex-shrink-0">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-subtle hover:text-accent transition-colors cursor-pointer">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Trader = {
  rank:    number;
  address: string;
  trades:  number;
  volume:  number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TABS   = ["Overview", "Advanced", "Activity"];
const MODES  = ["Copy Volume", "Supply", "Liquidity"];
const RANGES = ["1h", "6h", "24h", "7d", "1M"];

const fmtAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const fmtVol  = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1000    ? `$${(v / 1000).toFixed(1)}k`
  : `$${v.toFixed(0)}`;

type Trade = {
  id: string;
  leader: string;
  token: string;
  ausdcAllocated: number;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number;
  pnlPct: number;
  status: 'OPEN' | 'CLOSED' | 'SKIPPED';
  reason: string | null;
  openedAt: string;
  closedAt: string | null;
};

const TokenLogo = ({ symbol }: { symbol: string }) => {
  const sym = symbol.toUpperCase();
  let src = '';
  if (sym === 'WSOMI' || sym === 'SOMI') src = '/token-logos/WSOMI.png';
  else if (sym === 'USDC' || sym === 'USDC.E') src = '/token-logos/USDC.png';

  if (src) {
    return (
      <img
        src={src}
        alt={symbol}
        className="w-6 h-6 rounded-full object-cover border border-border bg-surface flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-surface to-border border border-border/60 flex items-center justify-center text-[10px] text-muted font-bold uppercase flex-shrink-0 select-none">
      {symbol.slice(0, 2)}
    </div>
  );
};

function PortfolioChart({ points }: { points: [number, number][] }) {
  if (points.length === 0) return null;
  const w = 320, h = 90;
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  
  // Pad Y-axis range if values are very close or identical (avoiding division by zero/extreme scaling)
  const avg = (minY + maxY) / 2;
  const diff = maxY - minY;
  const minDiff = Math.max(avg * 0.02, 10); // at least 2% of average or 10 units
  if (diff < minDiff) {
    minY = avg - minDiff / 2;
    maxY = avg + minDiff / 2;
  }
  
  const px = (x: number) => ((x - minX) / (maxX - minX || 1)) * (w - 12) + 6;
  const py = (y: number) => h - 6 - ((y - minY) / (maxY - minY || 1)) * (h - 16);
  
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ");
  const fd = `${d} L${px(maxX).toFixed(1)},${h} L${px(minX).toFixed(1)},${h} Z`;
  
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} fill="none" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8b848" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#e8b848" stopOpacity="0.00" />
        </linearGradient>
      </defs>
      <path d={fd} fill="url(#pg)" />
      <path d={d} stroke="#e8b848" strokeWidth="2" fill="none" strokeLinejoin="round" pathLength="1" className="animate-draw-path" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const router   = useRouter();
  const pathname = usePathname();
  const { authenticated } = usePrivy();
  const { address, isConnected } = useAccount();
  const { balance } = useAUSD();

  const [tab,     setTab]     = useState("Overview");
  const [mode,    setMode]    = useState("Copy Volume");
  const [range,   setRange]   = useState("1M");
  const [traders, setTraders] = useState<Trader[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<{ totalLocked: number; totalPnl: number } | null>(null);
  const [topTraderWindow, setTopTraderWindow] = useState<'1h' | '6h' | '24h'>('6h');
  const [topTraders, setTopTraders] = useState<Trader[]>([]);
  const [topTradersLoading, setTopTradersLoading] = useState(false);
  const [recentUserTrades, setRecentUserTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);

  useEffect(() => {
    fetch("/api/traders/leaderboard?window=24h")
      .then((r) => r.json())
      .then((d) => { if (d.traders?.length) setTraders(d.traders.slice(0, 4)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTopTradersLoading(true);
    fetch(`/api/traders/leaderboard?window=${topTraderWindow}`)
      .then((r) => r.json())
      .then((d) => { setTopTraders(d.traders?.length ? d.traders.slice(0, 3) : []); })
      .catch(() => {})
      .finally(() => setTopTradersLoading(false));
  }, [topTraderWindow]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/vaults/${address}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.summary) {
          setPortfolioSummary(d.summary);
        }
      })
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!address) {
      setRecentUserTrades([]);
      setAllTrades([]);
      return;
    }
    fetch(`/api/trades?address=${address}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.trades?.length) {
          // Float OPEN trades to top, then by most recent
          const sorted = [...d.trades].sort((a: Trade, b: Trade) => {
            if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
            if (b.status === 'OPEN' && a.status !== 'OPEN') return 1;
            return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
          });
          setRecentUserTrades(sorted.slice(0, 5));
          setAllTrades(d.trades);
        }
      })
      .catch(() => {});
  }, [address]);

  const portfolioValue = (portfolioSummary?.totalLocked ?? 0) + (portfolioSummary?.totalPnl ?? 0) + (balance ?? 0);
  const portfolioPnl = portfolioSummary?.totalPnl ?? 0;
  const portfolioPnlPct = (portfolioSummary?.totalLocked ?? 0) > 0 ? (portfolioPnl / portfolioSummary!.totalLocked) * 100 : 0;

  const chartPoints = useMemo(() => {
    const closedTrades = allTrades
      .filter((t) => t.status === 'CLOSED' && t.closedAt)
      .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());

    const displayValue = portfolioValue > 0 ? portfolioValue : (balance ? Number(balance) : 10000);
    const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const baseline = displayValue - totalRealizedPnl - portfolioPnl;

    const now = Date.now();
    let startTime = now - 24 * 60 * 60 * 1000; // default 24h ago
    
    const allValidTrades = allTrades.filter(t => t.openedAt);
    if (allValidTrades.length > 0) {
      const firstTradeTime = Math.min(...allValidTrades.map(t => new Date(t.openedAt!).getTime()));
      // Start 24 hours before first trade to display the baseline clearly, or at least 24 hours ago
      startTime = Math.min(firstTradeTime - 24 * 60 * 60 * 1000, now - 24 * 60 * 60 * 1000);
    }

    const steps = 30;
    const points: [number, number][] = [];
    
    for (let i = 0; i < steps; i++) {
      const t = startTime + (i / (steps - 1)) * (now - startTime);
      
      // Calculate contribution of each trade at timestamp t
      let pnlAtT = 0;
      for (const trade of allTrades) {
        if (!trade.openedAt) continue;
        const openTime = new Date(trade.openedAt).getTime();
        const closeTime = trade.closedAt ? new Date(trade.closedAt).getTime() : now;
        const finalPnl = trade.pnl ?? 0;
        
        if (t >= openTime) {
          if (t >= closeTime) {
            pnlAtT += finalPnl;
          } else {
            // Linear interpolation of PnL during active trade duration
            const duration = closeTime - openTime;
            const elapsed = t - openTime;
            const pct = duration > 0 ? elapsed / duration : 1;
            pnlAtT += finalPnl * pct;
          }
        }
      }
      
      points.push([t, baseline + pnlAtT]);
    }

    return points;
  }, [allTrades, portfolioValue, portfolioPnl, balance]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <AppNavbar />

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[6fr_4fr] gap-6 px-[7.5%] pt-8 pb-6 w-full flex-1 overflow-hidden">

        {/* ── Main column (60%) ──────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-w-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

          {/* Hero card */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 animate-fade-in-up stagger-1 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-spring">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative w-12 h-9 flex-shrink-0">
                <img
                  src="/token-logos/WSOMI.png"
                  alt="WSOMI"
                  className="absolute left-0 top-0 w-8 h-8 rounded-full border-2 border-card object-cover bg-surface"
                />
                <img
                  src="/token-logos/USDC.png"
                  alt="USDC"
                  className="absolute left-4 top-0 w-8 h-8 rounded-full border-2 border-card object-cover bg-surface"
                />
              </div>
              <h1 className="text-[24px] font-semibold tracking-tight">WSOMI / USDC</h1>
              <span className="text-[12px] bg-surface border border-border rounded-full px-2.5 py-0.5 text-muted">98%</span>
              <span className="text-[12px] bg-surface/50 border border-border/60 rounded-full px-2.5 py-0.5 text-subtle flex items-center gap-1 cursor-pointer hover:border-subtle/40 transition-colors">
                Live Rate <InfoIcon />
              </span>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {[
                { l: "Total Copy Volume", v: "$65.68M", s: "65.68M USDC" },
                { l: "Active Agents",     v: "$32.76M", s: "65.68M WSOMI"  },
                { l: "Avg Copy Rate",     v: "6.19%",   s: "65.68M aUSD"   },
              ].map(({ l, v, s }) => (
                <div key={l}>
                  <div className="flex items-center gap-1 text-[11px] text-subtle mb-1.5"><span>{l}</span><InfoIcon /></div>
                  <div className="text-[28px] font-light tabular-nums tracking-tight">{v}</div>
                  <div className="text-[11px] text-subtle mt-0.5">{s}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs + trader cards */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 animate-fade-in-up stagger-2">
            <div className="flex items-center gap-1 mb-4">
              {TABS.map(t => <Pill key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {traders.map((trader) => (
                <div
                  key={trader.address}
                  onClick={() => router.push(`/traders/${trader.address}`)}
                  className="bg-surface/60 border border-border rounded-xl p-4 hover:border-accent/50 hover:shadow-md hover:shadow-accent/5 transition-spring hover:scale-[1.03] active:scale-98 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-subtle uppercase tracking-wider">Top Trader #{trader.rank}</span>
                    <CopyIcon />
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <a
                      href={`https://explorer.somnia.network/address/${trader.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-[12px] text-foreground/85 hover:text-accent hover:underline decoration-accent/50 transition-colors"
                    >
                      {fmtAddr(trader.address)}
                    </a>
                    <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded font-medium">{trader.trades}tx</span>
                  </div>
                  <div className="text-[10px] text-subtle uppercase tracking-wider mb-0.5">24h Volume</div>
                  <div className="text-[14px] font-semibold">{fmtVol(trader.volume)}</div>
                </div>
              ))}
              {traders.length === 0 && (
                <>
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-surface/60 border border-border rounded-xl p-4 animate-pulse flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-3 bg-border/40 rounded w-20" />
                          <div className="w-3.5 h-3.5 bg-border/40 rounded-sm" />
                        </div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="h-4 bg-border/40 rounded w-24" />
                          <div className="h-4 bg-border/40 rounded w-8" />
                        </div>
                      </div>
                      <div>
                        <div className="h-3 bg-border/40 rounded w-16 mb-1.5" />
                        <div className="h-4 bg-border/40 rounded w-20" />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Volume chart */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 animate-fade-in-up stagger-3">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-subtle mb-1">Total Copy Volume (USD) <InfoIcon /></div>
                <div className="text-[28px] font-light tabular-nums tracking-tight">$59.19M</div>
                <div className="text-[11px] text-subtle mt-0.5">65.68M USDC</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-surface border border-border rounded-full p-0.5">
                  {MODES.map(m => <Pill key={m} label={m} active={mode === m} onClick={() => setMode(m)} />)}
                </div>
                <div className="flex items-center gap-0.5 bg-surface border border-border rounded-full p-0.5">
                  {RANGES.map(r => <Pill key={r} label={r} active={range === r} onClick={() => setRange(r)} />)}
                </div>
              </div>
            </div>
            <div className="mt-3 h-[200px]"><MainChart /></div>
          </div>

          {/* Rate chart */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 animate-fade-in-up stagger-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-subtle mb-1">Copy Rate <InfoIcon /></div>
                <div className="flex items-end gap-0.5">
                  <span className="text-[28px] font-light tabular-nums tracking-tight">6.19</span>
                  <span className="text-[18px] font-light text-muted mb-0.5">%</span>
                </div>
              </div>
              <button className="flex items-center gap-1 bg-surface border border-border rounded-full px-3 py-1 text-[12px] text-muted hover:border-subtle/40 transition-colors cursor-pointer">
                1 month <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 h-[110px]"><RateChart /></div>
              <div className="w-48 flex flex-col justify-center gap-3">
                {[
                  { l: "Native Copy Rate", v: "6.19%",  c: "text-foreground",  dot: "bg-accent"      },
                  { l: "Net Rate",         v: "+0.19%", c: "text-accent",      dot: "bg-accent/80"   },
                  { l: "WSOMI Yield",      v: "+6.43%", c: "text-emerald-400", dot: "bg-emerald-400" },
                ].map(({ l, v, c, dot }) => (
                  <div key={l} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />{l}
                    </div>
                    <span className={`text-[12px] font-medium tabular-nums ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar / Right Column (40%) ─────────────────────── */}
        <div className="flex flex-col gap-6 min-w-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

          {/* Portfolio Chart Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-spring animate-scale-in">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] text-subtle uppercase tracking-wider mb-1">Portfolio Value</p>
                <h2 className="text-[28px] font-light tracking-tight text-foreground tabular-nums">
                  ${portfolioValue > 0 ? portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (balance ? balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "10,000.00")}
                </h2>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <span className={portfolioPnl >= 0 ? "text-emerald-400" : "text-red-400 font-semibold"}>
                    {portfolioPnl >= 0 ? "+" : ""}${portfolioPnl.toFixed(2)} ({portfolioPnlPct >= 0 ? "+" : ""}{portfolioPnlPct.toFixed(1)}%)
                  </span>
                  <span className="text-subtle">Unrealized Profits</span>
                </div>
              </div>
              <div className="text-[11px] bg-surface border border-border rounded-full px-2.5 py-0.5 text-muted font-normal">
                Live Equity
              </div>
            </div>
            
            <div className="h-[90px] w-full mt-2">
              <PortfolioChart points={chartPoints} />
            </div>
          </div>

          {/* Top Traders — windowed */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-spring animate-scale-in stagger-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-foreground">Top Traders</h3>
              {/* Time-window pill switcher */}
              <div className="flex items-center bg-surface/60 border border-border/40 rounded-full p-0.5 gap-0.5">
                {(['1h', '6h', '24h'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setTopTraderWindow(w)}
                    className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full transition-spring cursor-pointer ${
                      topTraderWindow === w
                        ? 'bg-accent text-accent-foreground shadow-sm shadow-accent/20'
                        : 'text-subtle hover:text-foreground'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {topTradersLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-[52px] bg-surface/50 border border-border/60 rounded-xl animate-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
                ))
              ) : topTraders.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-[12px] text-subtle">No active trades in the last {topTraderWindow}.</p>
                </div>
              ) : (
                topTraders.map((trader, i) => (
                  <div
                    key={trader.address}
                    onClick={() => router.push('/traders')}
                    className="bg-surface/50 border border-border/60 rounded-xl p-3 flex items-center justify-between hover:border-accent/40 hover:bg-surface/80 transition-spring hover:scale-[1.02] active:scale-98 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">

                      <Avatar address={trader.address} size={28} />
                      <span className="font-mono text-[12px] text-foreground/80 truncate">
                        {fmtAddr(trader.address)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-subtle uppercase tracking-wider">{topTraderWindow} Volume</p>
                      <p className="text-[13px] font-semibold tabular-nums text-foreground/90">{fmtVol(trader.volume)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-spring animate-scale-in stagger-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-foreground">Transaction History</h3>
              {authenticated && recentUserTrades.length > 0 && (
                <Link href="/trades" className="text-[11px] text-accent hover:underline cursor-pointer">
                  View all
                </Link>
              )}
            </div>

            {!authenticated ? (
              <div className="py-6 text-center">
                <p className="text-subtle text-[12px] mb-3">Connect wallet to view transactions.</p>
                <ConnectButton fullWidth />
              </div>
            ) : recentUserTrades.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-[12px] text-subtle">No trades copied yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recentUserTrades.map((trade) => {
                  const isProfit = trade.pnl >= 0;
                  const isOpen   = trade.status === 'OPEN';
                  
                  return (
                    <div
                      key={trade.id}
                      onClick={() => router.push(`/traders/${trade.leader}`)}
                      className={`bg-surface/50 border rounded-xl p-3 flex items-center justify-between hover:bg-surface/80 transition-spring hover:scale-[1.02] active:scale-98 cursor-pointer ${
                        isOpen ? 'border-emerald-500/30 hover:border-emerald-400/50' : 'border-border/60 hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TokenLogo symbol={trade.token} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate">
                            {trade.token}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10.5px] font-mono text-accent font-medium">
                              {fmtAddr(trade.leader)}
                            </span>
                            <span className="text-[9px] text-border">•</span>
                            {isOpen ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Open
                              </span>
                            ) : (
                              <span className="text-[10px] text-subtle uppercase tracking-wider">Closed</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[12px] font-semibold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfit ? '+' : ''}{trade.pnl.toFixed(2)} aUSD
                        </p>
                        <p className="text-[10px] text-subtle mt-0.5 tabular-nums">
                          {trade.ausdcAllocated} aUSD
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[10px] text-subtle text-center leading-relaxed px-1">
            aUSD is locked in a smart contract on Somnia Testnet (chain 50312). A keeper executes copy trades on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
}
