import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Faucet' };

export default function FaucetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
