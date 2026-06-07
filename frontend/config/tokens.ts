// Token addresses on Somnia Mainnet (where leaders trade).
// VaultManager on testnet uses these same addresses as keys in its
// latestPrice mapping and allowlist — keep them in sync with the watcher config.

export const MAINNET_TOKENS: Record<string, `0x${string}`> = {
  'WSOMI':   '0x046EDe9564A72571df6F5e44d0405360c0f4dCab',
  'USDC':    '0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00',
  'NIA':     '0xC063B29CD6B30885783B505aE180B3079e0A2154',
  'USDT':    '0x67B302E35Aef5EEE8c32D934F5856869EF428330',
};

// Reverse lookup — canonical lowercase address → display symbol
export const TOKEN_SYMBOL: Record<string, string> = {
  '0x046ede9564a72571df6f5e44d0405360c0f4dcab': 'WSOMI',
  '0x28bec7e30e6faee657a03e19bf1128aad7632a00': 'USDC',
  '0xc063b29cd6b30885783b505ae180b3079e0a2154': 'NIA',
  '0x67b302e35aef5eee8c32d934f5856869ef428330': 'USDT',
};

export function symbolToAddress(symbol: string): `0x${string}` | undefined {
  return MAINNET_TOKENS[symbol];
}

export function addressToSymbol(address: string): string {
  return TOKEN_SYMBOL[address.toLowerCase()] ?? address.slice(0, 6) + '…';
}
