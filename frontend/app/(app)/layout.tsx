import AppNavbar from '@/components/AppNavbar';
import OnboardingModal from '@/components/OnboardingModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none">
      <AppNavbar />
      <OnboardingModal />
      {children}
    </div>
  );
}
