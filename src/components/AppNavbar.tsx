// src/components/AppNavbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectButton from '@/components/ConnectButton';

export default function AppNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-black border-b border-white/[0.06] flex items-center justify-between px-6 select-none">
      {/* Left logo */}
      <Link href="/" className="text-white font-medium text-lg tracking-tight hover:opacity-90 transition-opacity">
        aionis
      </Link>

      {/* Center navigation links */}
      <div className="flex items-center gap-6">
        <Link
          href="/traders"
          className={`text-sm font-medium transition-colors ${
            pathname === '/traders'
              ? 'text-white'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          Traders
        </Link>
        <Link
          href="/portfolio"
          className={`text-sm font-medium transition-colors ${
            pathname === '/portfolio'
              ? 'text-white'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          Portfolio
        </Link>
      </div>

      {/* Right button */}
      <div>
        <ConnectButton />
      </div>
    </nav>
  );
}
