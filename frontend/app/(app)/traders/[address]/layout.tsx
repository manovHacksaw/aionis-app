import type { Metadata } from 'next';

function fmt(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  return { title: `Trader ${fmt(address)}` };
}

export default function TraderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
