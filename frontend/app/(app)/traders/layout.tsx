import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Traders' };

export default function TradersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
