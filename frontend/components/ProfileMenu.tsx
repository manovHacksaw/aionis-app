'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Avatar from './Avatar';

export default function ProfileMenu() {
  const { ready, authenticated, user, logout } = usePrivy();
  const address = user?.wallet?.address;
  const pathname = usePathname();
  const isOnProfile = pathname === '/profile';
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!address) return;
    fetch(`/api/profile/avatar?address=${address}`)
      .then((r) => r.json())
      .then((d) => { if (d.avatarUrl) setAvatarUrl(d.avatarUrl); })
      .catch(() => {});
  }, [address]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!ready || !authenticated || !address) return null;

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Avatar trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-11 h-11 rounded-full bg-surface/60 backdrop-blur-md border flex items-center justify-center transition-spring hover:scale-105 active:scale-95 overflow-hidden cursor-pointer ${
          isOnProfile
            ? 'border-accent shadow-[0_0_0_2px_hsl(var(--accent)/0.35)] scale-105'
            : 'border-border/40 hover:border-accent/40'
        }`}
        aria-label="Profile menu"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <Avatar address={address} size={44} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] w-52 bg-card border border-border/80 rounded-2xl shadow-xl shadow-black/20 backdrop-blur-xl overflow-hidden z-50 animate-scale-in origin-top-right"
          style={{ transformOrigin: 'top right' }}
        >
          {/* Address row */}
          <div 
            onClick={handleCopy}
            className="px-4 py-3 border-b border-border/60 hover:bg-surface/50 cursor-pointer group transition-colors relative"
            title="Click to copy full address"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-subtle uppercase tracking-wider mb-1">Wallet</p>
              {copied ? (
                <span className="text-[9px] text-accent uppercase font-medium">Copied!</span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 text-subtle opacity-0 group-hover:opacity-100 transition-opacity">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.25 2.25 0 0 0-1.75 3.364M18.75 7.5V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V7.5M18.75 7.5V5.25A2.25 2.25 0 0 0 16.5 3h-9A2.25 2.25 0 0 0 5.25 5.25V7.5m13.5 0h-13.5" />
                </svg>
              )}
            </div>
            <p className="font-mono text-[13px] text-foreground group-hover:text-accent transition-colors">{short}</p>
          </div>

          {/* Menu items */}
          <div className="p-1.5 flex flex-col gap-0.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-foreground hover:bg-surface/80 hover:text-accent transition-spring hover:scale-[1.01] cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              View Profile
            </Link>

            <button
              type="button"
              onClick={() => { setOpen(false); logout(); }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:bg-red-500/10 transition-spring hover:scale-[1.01] cursor-pointer w-full text-left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
