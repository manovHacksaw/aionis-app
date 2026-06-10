import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Manage Agent' };

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
