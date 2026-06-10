import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Trade Details' };

export default function TradeDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
