import AppNavbar from '@/components/AppNavbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col select-none" style={{ fontFamily: "var(--font-geist-sans, system-ui)" }}>
      <AppNavbar />
      {children}
    </div>
  );
}
