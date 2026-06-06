'use client';

import { usePrivy } from '@privy-io/react-auth';

export default function ConnectButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) return null;

  const base = `bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold transition-colors cursor-pointer${
    fullWidth
      ? ' w-full py-3 rounded-xl text-[14px]'
      : ' text-[13.5px] px-5 py-1.5 rounded-full whitespace-nowrap'
  }`;

  if (authenticated) {
    const addr  = user?.wallet?.address;
    const label = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Account';
    return <button onClick={logout} className={base}>{label}</button>;
  }

  return <button onClick={login} className={base}>Connect Wallet</button>;
}
