import { defineChain } from 'viem';

export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { decimals: 18, name: 'Somnia Test Token', symbol: 'STT' },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
    public:  { http: ['https://dream-rpc.somnia.network'] },
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://testnet.somnia.exploreme.pro' },
  },
});
