'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';

type Notification = {
  id:        string;
  type:      'FOLLOW' | 'TRADE_OPENED' | string;
  actor:     string | null;
  message:   string;
  read:      boolean;
  createdAt: string;
};

const POLL_MS = 30_000;

const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'TRADE_OPENED') {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </div>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;

  const [open, setOpen]               = useState(false);
  const [items, setItems]             = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]         = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/notifications?address=${address}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications ?? []);
        setUnreadCount(d.unreadCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Poll for the unread badge even while the dropdown is closed.
  useEffect(() => {
    if (!address) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [address]);

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = (id?: string) => {
    if (!address) return;
    fetch('/api/notifications/read', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ address, id }),
    }).then(() => {
      setItems((prev) => prev.map((n) => (!id || n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => (id ? Math.max(0, c - 1) : 0));
    }).catch(() => {});
  };

  const handleClick = (n: Notification) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    if (n.actor && n.type === 'TRADE_OPENED') router.push(`/traders/${n.actor}/manage`);
    else if (n.actor) router.push(`/traders/${n.actor}`);
  };

  if (!ready || !authenticated || !address) return null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group w-11 h-11 rounded-full bg-surface/60 backdrop-blur-md border border-border/40 flex items-center justify-center text-muted hover:text-foreground hover:border-accent/40 transition-spring cursor-pointer hover:scale-105 active:scale-95 relative"
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon className="animate-bell" />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-accent text-accent-foreground text-[9px] font-semibold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] w-80 max-h-[28rem] flex flex-col bg-card border border-border/80 rounded-2xl shadow-xl shadow-black/20 backdrop-blur-xl overflow-hidden z-50 animate-scale-in origin-top-right"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 flex-shrink-0">
            <p className="text-[13px] text-foreground font-medium">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markRead()}
                className="text-[11px] text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 && (
              <p className="text-[12px] text-subtle text-center py-10">Loading…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="text-[12px] text-subtle text-center py-10">You&apos;re all caught up.</p>
            )}
            <div className="flex flex-col">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 text-left border-b border-border/40 last:border-b-0 hover:bg-surface/60 transition-colors cursor-pointer ${
                    n.read ? '' : 'bg-accent/[0.04]'
                  }`}
                >
                  <TypeIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-foreground leading-snug">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-subtle">{timeAgo(n.createdAt)}</span>
                      {n.actor && (
                        <span className="text-[10px] text-subtle font-mono">· {fmt(n.actor)}</span>
                      )}
                    </div>
                  </div>
                  {!n.read && <span className="w-[7px] h-[7px] rounded-full bg-accent flex-shrink-0 mt-1.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
