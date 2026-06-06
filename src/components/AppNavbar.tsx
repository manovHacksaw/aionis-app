'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectButton from '@/components/ConnectButton';

const NAV_LINKS = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Traders',   href: '/traders'   },
  { name: 'Portfolio', href: '/portfolio' },
  { name: 'Vault',     href: '/vault'     },
];

export default function AppNavbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-[#0d0d0d]/95 backdrop-blur-md select-none flex-shrink-0">
      <div className="h-[60px] flex items-center gap-8 px-16 max-w-[1440px] mx-auto w-full mt-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
          <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="black" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white">Aionis</span>
        </Link>

        {/* Nav tabs — free-floating, no container */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-1.5 rounded-full text-[13.5px] font-medium transition-all duration-200 ${
                pathname.startsWith(l.href)
                  ? 'bg-amber-500 text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {l.name}
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        {/* Chain indicator */}
        <button className="flex items-center gap-2 text-[13px] text-zinc-300 hover:text-white transition-colors cursor-pointer">
          Somnia
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <ConnectButton />
      </div>
    </nav>
  );
}
