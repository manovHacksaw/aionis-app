'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectButton from './ConnectButton';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Traders',   href: '/traders' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'aUSD',      href: '/faucet' },
];

export default function AppNavbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-[#0d0d0d] backdrop-blur-md flex-shrink-0">
      <div className="h-[60px] flex items-center px-16 gap-8 max-w-[1440px] mx-auto w-full mt-8">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="black" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Aionis</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ label, href }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                className={`px-4 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 cursor-pointer ${
                  active ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
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
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        <ConnectButton />
      </div>
    </header>
  );
}
