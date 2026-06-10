const TOKEN_HUES: Record<string, number> = { WSOMI: 32, USDC: 200, NIA: 280, USDT: 150 };
export const tokenHue = (token: string) => TOKEN_HUES[token] ?? (token.charCodeAt(0) * 47) % 360;

export const TokenBadge = ({ token, size = 36 }: { token: string; size?: number }) => {
  const sym = token.toUpperCase();
  let src = '';
  if (sym === 'WSOMI' || sym === 'SOMI') src = '/token-logos/WSOMI.png';
  else if (sym === 'USDC' || sym === 'USDC.E') src = '/token-logos/USDC.png';
  else if (sym === 'AUSD') src = '/token-logos/aUSD.svg';
  else if (sym === 'USDT') src = '/token-logos/USDT.svg';

  if (src) {
    return (
      <img
        src={src}
        alt={token}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-border bg-surface flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 border border-border/60 bg-gradient-to-br from-surface to-border select-none"
      style={{ width: size, height: size }}
    >
      <svg
        style={{ width: size * 0.55, height: size * 0.55 }}
        className="text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2" />
        <path d="M12 6v12" />
      </svg>
    </div>
  );
};
