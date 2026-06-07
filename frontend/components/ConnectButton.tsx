'use client';

import { usePrivy } from '@privy-io/react-auth';

export default function ConnectButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready || authenticated) return null;

  const base = `bg-accent hover:bg-accent-hover active:bg-accent-active text-accent-foreground font-semibold cursor-pointer transition-spring hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg hover:shadow-accent/20 ${
    fullWidth
      ? ' w-full py-3 rounded-xl text-[14px]'
      : ' text-[15px] px-6 py-2.5 rounded-full whitespace-nowrap'
  }`;

  return <button onClick={login} className={base}>Connect Wallet</button>;
}
