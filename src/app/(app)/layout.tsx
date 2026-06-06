import AppNavbar from '@/components/AppNavbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      <AppNavbar />
      {children}
    </div>
  );
}
