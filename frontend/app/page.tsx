"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ConnectButton from "@/components/ConnectButton";
import { usePrivy } from "@privy-io/react-auth";

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ points, color = "#f59e0b" }: { points: [number, number][]; color?: string }) {
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
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
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
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yVs.map((yv, i) => (
        <g key={yv}>
          <line x1={pad.l} y1={py(yv)} x2={W - pad.r} y2={py(yv)} stroke="#27272a" strokeWidth="1" strokeDasharray="4 3" />
          <text x={W - pad.r + 6} y={py(yv) + 4} fill="#52525b" fontSize="10">{yLs[i]}</text>
        </g>
      ))}
      <path d={fd} fill="url(#cg)" />
      <path d={d} stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinejoin="round" />
      {xLs.map((l, i) => (
        <text key={l} x={pad.l + (i / (xLs.length - 1)) * cw} y={H - 6} fill="#52525b" fontSize="9.5" textAnchor="middle">{l}</text>
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
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[7.5,5.0,2.5].map((yv,i) => (
        <g key={yv}>
          <line x1={4} y1={py(yv)} x2={W-54} y2={py(yv)} stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />
          <text x={W-50} y={py(yv)+4} fill="#52525b" fontSize="9">{["7.50%","5.00%","2.50%"][i]}</text>
        </g>
      ))}
      <path d={fd} fill="url(#rg)" />
      <path d={d} stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <text x={avg} y={py(5.4) - 4} fill="#a1a1aa" fontSize="9">Avg 5.94%</text>
    </svg>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer ${active ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-white"}`}>
      {label}
    </button>
  );
}

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 flex-shrink-0">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 hover:text-amber-400 transition-colors cursor-pointer">
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

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Traders",   href: "/traders" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Vault",     href: "/vault" },
];
const TABS   = ["Overview", "Advanced", "Activity"];
const MODES  = ["Copy Volume", "Supply", "Liquidity"];
const RANGES = ["1h", "6h", "24h", "7d", "1M"];

const fmtAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const fmtVol  = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1000    ? `$${(v / 1000).toFixed(1)}k`
  : `$${v.toFixed(0)}`;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const router   = useRouter();
  const pathname = usePathname();
  const { authenticated } = usePrivy();

  const [tab,     setTab]     = useState("Overview");
  const [mode,    setMode]    = useState("Copy Volume");
  const [range,   setRange]   = useState("1M");
  const [traders, setTraders] = useState<Trader[]>([]);

  useEffect(() => {
    fetch("/api/traders/leaderboard?window=24h")
      .then((r) => r.json())
      .then((d) => { if (d.traders?.length) setTraders(d.traders.slice(0, 4)); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col select-none" style={{ fontFamily: "var(--font-geist-sans, system-ui)" }}>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0d0d0d] backdrop-blur-md flex-shrink-0">
        <div className="h-[60px] flex items-center px-16 gap-8 max-w-[1440px] mx-auto w-full mt-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="black" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Aionis</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ label, href }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={label}
                  href={href}
                  className={`px-4 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 cursor-pointer ${
                    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <button className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] text-zinc-300 hover:text-white transition-colors cursor-pointer">
            Somnia
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          <ConnectButton />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-5 px-16 pt-8 pb-6 w-full max-w-[1440px] mx-auto overflow-hidden">

        {/* ── Main column ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

          {/* Hero card */}
          <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative w-12 h-9 flex-shrink-0">
                <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-[#141414] flex items-center justify-center">
                  <span className="text-[9px] text-black font-bold">W</span>
                </div>
                <div className="absolute left-4 top-0 w-8 h-8 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-400 border-2 border-[#141414] flex items-center justify-center">
                  <span className="text-[9px] text-black font-bold">$</span>
                </div>
              </div>
              <h1 className="text-[24px] font-semibold tracking-tight">WSOMI / USDC.e</h1>
              <span className="text-[12px] bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-0.5 text-zinc-300">98%</span>
              <span className="text-[12px] bg-zinc-800/50 border border-zinc-700/60 rounded-full px-2.5 py-0.5 text-zinc-400 flex items-center gap-1 cursor-pointer hover:border-zinc-600 transition-colors">
                Live Rate <InfoIcon />
              </span>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {[
                { l: "Total Copy Volume", v: "$65.68M", s: "65.68M USDC.e" },
                { l: "Active Vaults",     v: "$32.76M", s: "65.68M WSOMI"  },
                { l: "Avg Copy Rate",     v: "6.19%",   s: "65.68M aUSD"   },
              ].map(({ l, v, s }) => (
                <div key={l}>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-500 mb-1.5"><span>{l}</span><InfoIcon /></div>
                  <div className="text-[26px] font-semibold tabular-nums">{v}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{s}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs + trader cards */}
          <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-1 mb-4">
              {TABS.map(t => <Pill key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {traders.map((trader) => (
                <div
                  key={trader.address}
                  onClick={() => router.push(`/vault/${trader.address}`)}
                  className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Top Trader #{trader.rank}</span>
                    <CopyIcon />
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <a
                      href={`https://explorer.somnia.network/address/${trader.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-[12px] text-white/85 hover:text-amber-400 hover:underline decoration-amber-500/50 transition-colors"
                    >
                      {fmtAddr(trader.address)}
                    </a>
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-medium">{trader.trades}tx</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">24h Volume</div>
                  <div className="text-[14px] font-semibold">{fmtVol(trader.volume)}</div>
                </div>
              ))}
              {traders.length === 0 && (
                <>
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 animate-pulse flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-3 bg-zinc-800/40 rounded w-20" />
                          <div className="w-3.5 h-3.5 bg-zinc-800/40 rounded-sm" />
                        </div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="h-4 bg-zinc-800/40 rounded w-24" />
                          <div className="h-4 bg-zinc-800/40 rounded w-8" />
                        </div>
                      </div>
                      <div>
                        <div className="h-3 bg-zinc-800/40 rounded w-16 mb-1.5" />
                        <div className="h-4 bg-zinc-800/40 rounded w-20" />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Volume chart */}
          <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-zinc-500 mb-1">Total Copy Volume (USD) <InfoIcon /></div>
                <div className="text-[28px] font-semibold tabular-nums">$59.19M</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">65.68M USDC.e</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-full p-0.5">
                  {MODES.map(m => <Pill key={m} label={m} active={mode === m} onClick={() => setMode(m)} />)}
                </div>
                <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-full p-0.5">
                  {RANGES.map(r => <Pill key={r} label={r} active={range === r} onClick={() => setRange(r)} />)}
                </div>
              </div>
            </div>
            <div className="mt-3 h-[200px]"><MainChart /></div>
          </div>

          {/* Rate chart */}
          <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-zinc-500 mb-1">Copy Rate <InfoIcon /></div>
                <div className="flex items-end gap-0.5">
                  <span className="text-[28px] font-semibold tabular-nums">6.19</span>
                  <span className="text-[18px] font-semibold text-zinc-400 mb-0.5">%</span>
                </div>
              </div>
              <button className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-[12px] text-zinc-400 hover:border-zinc-700 transition-colors cursor-pointer">
                1 month <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 h-[110px]"><RateChart /></div>
              <div className="w-48 flex flex-col justify-center gap-3">
                {[
                  { l: "Native Copy Rate", v: "6.19%",  c: "text-white",       dot: "bg-amber-500"   },
                  { l: "Net Rate",         v: "+0.19%", c: "text-amber-400",   dot: "bg-amber-400"   },
                  { l: "WSOMI Yield",      v: "+6.43%", c: "text-emerald-400", dot: "bg-emerald-400" },
                ].map(({ l, v, c, dot }) => (
                  <div key={l} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />{l}
                    </div>
                    <span className={`text-[12px] font-medium tabular-nums ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <div className="w-[280px] flex-shrink-0 flex flex-col gap-4">

          {/* Supply cards */}
          {[
            { title: "Allocate to Vault (WSOMI)", spark: SPARK1, badge: "+$2,853" },
            { title: "Withdraw aUSD",             spark: SPARK2, badge: "+$1,100" },
          ].map(({ title, spark, badge }) => (
            <div key={title} className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-zinc-400">{title}</span>
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[20px] font-light tabular-nums">0.00</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">0%</div>
                </div>
                <div className="relative">
                  <Sparkline points={spark} />
                  <div className="absolute -top-1 right-0 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {badge}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Position panel */}
          <div className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] text-zinc-500 mb-0.5">Your vault position (WSOMI)</div>
                <div className="text-[20px] font-light tabular-nums">0.00</div>
              </div>
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-amber-500/50" />
              </div>
            </div>

            <div>
              <div className="text-[11px] text-zinc-500 mb-0.5">Unrealized P&L (aUSD)</div>
              <div className="text-[20px] font-light tabular-nums">0.00</div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-zinc-500">Risk Level / Max Risk</span>
                <span className="font-medium text-white">0% / 89%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full w-0 bg-amber-500 rounded-full transition-all" />
              </div>
            </div>

            <div className="flex gap-1">
              {[1,2,3,4,5].map(d => (
                <div key={d} className="flex-1 h-1 rounded-full bg-zinc-800" />
              ))}
            </div>
          </div>

          {/* CTA */}
          {authenticated ? (
            <button
              onClick={() => router.push("/traders")}
              className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold text-[14px] py-3 rounded-xl transition-colors cursor-pointer"
            >
              Browse Traders
            </button>
          ) : (
            <ConnectButton fullWidth />
          )}

          <p className="text-[10px] text-zinc-600 text-center leading-relaxed px-1">
            aUSD is locked in a smart contract on Somnia Testnet (chain 50312). A keeper executes copy trades on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
}
