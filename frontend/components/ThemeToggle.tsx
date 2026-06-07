'use client';

import { useTheme } from './ThemeProvider';

function SunIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="relative w-[52px] h-[30px] rounded-full bg-surface border border-border flex items-center px-[3px] cursor-pointer transition-spring hover:border-accent/40 active:scale-95"
    >
      <span
        className={`absolute top-[2px] w-[24px] h-[24px] rounded-full bg-accent flex items-center justify-center text-accent-foreground shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isDark ? 'left-[25px]' : 'left-[3px]'
        }`}
      >
        <span className="relative w-full h-full flex items-center justify-center">
          <SunIcon
            className={`absolute transition-all duration-300 ease-out ${
              isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
            }`}
          />
          <MoonIcon
            className={`absolute transition-all duration-300 ease-out ${
              isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
            }`}
          />
        </span>
      </span>
    </button>
  );
}
