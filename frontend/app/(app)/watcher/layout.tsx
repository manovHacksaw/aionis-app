import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Watcher' };

export default function WatcherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
