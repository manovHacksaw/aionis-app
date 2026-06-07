import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import { createPublicClient, http } from 'viem';
import { somniaTestnet } from '@/config/chains';
import { getWsomiPrice } from '@/lib/price';
import VAULT_ABI from '@/contracts/artifacts/contracts/VaultManager.sol/VaultManager.json';

const VAULT_MANAGER = (process.env.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS ?? '') as `0x${string}`;

const VAULT_ABI_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'follower', type: 'address' },
      { internalType: 'address', name: 'leader',   type: 'address' },
    ],
    name:            'getOpenPositions',
    outputs:         [{ internalType: 'bytes32[]', name: 'openIds', type: 'bytes32[]' }],
    stateMutability: 'view',
    type:            'function',
  },
  {
    inputs:  [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name:    'positions',
    outputs: [
      { internalType: 'address',        name: 'follower',      type: 'address' },
      { internalType: 'address',        name: 'leader',        type: 'address' },
      { internalType: 'bytes32',        name: 'vaultId',       type: 'bytes32' },
      { internalType: 'address',        name: 'token',         type: 'address' },
      { internalType: 'uint256',        name: 'ausdAllocated', type: 'uint256' },
      { internalType: 'uint256',        name: 'entryPrice',    type: 'uint256' },
      { internalType: 'uint256',        name: 'exitPrice',     type: 'uint256' },
      { internalType: 'int256',         name: 'pnl',           type: 'int256'  },
      { internalType: 'uint8',          name: 'status',        type: 'uint8'   },
      { internalType: 'uint256',        name: 'openedAt',      type: 'uint256' },
      { internalType: 'uint256',        name: 'closedAt',      type: 'uint256' },
    ],
    stateMutability: 'view',
    type:            'function',
  },
] as const;

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
});

const ADDRESS_TO_SYMBOL: Record<string, string> = {
  '0x046ede9564a72571df6f5e44d0405360c0f4dcab': 'WSOMI',
  '0x28bec7e30e6faee657a03e19bf1128aad7632a00': 'USDC',
  '0xc063b29cd6b30885783b505ae180b3079e0a2154': 'NIA',
  '0x67b302e35aef5eee8c32d934f5856869ef428330': 'USDT',
};

async function getLivePrice(tokenAddress: string, wsomiPrice: number): Promise<number> {
  const symbol = ADDRESS_TO_SYMBOL[tokenAddress.toLowerCase()];
  if (!symbol) return 0;
  if (symbol === 'WSOMI') return wsomiPrice;
  if (symbol === 'USDC' || symbol === 'USDT') return 1.0;
  if (symbol === 'NIA') {
    try {
      const stateNia = await client.readContract({
        address: '0x89B6827843B884B862489C2Fc526374D0F9F1c39' as `0x${string}`,
        abi: [{
          inputs: [],
          name: 'globalState',
          outputs: [{ name: 'price', type: 'uint160' }],
          stateMutability: 'view',
          type: 'function',
        }],
        functionName: 'globalState',
      });
      const rawNia = Number(stateNia as bigint) / 2 ** 96;
      return 1e12 / (rawNia * rawNia);
    } catch {
      return 0.005;
    }
  }
  return 0;
}

// GET /api/vaults/[address]
// Returns all UserVaults for a follower address, with open positions
// queried live from the blockchain and unrealized P&L calculated.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const follower = address.toLowerCase();

  const vaults = await prisma.userVault.findMany({
    where:   { follower },
    orderBy: { createdAt: 'desc' },
  });

  if (vaults.length === 0) {
    return NextResponse.json({ vaults: [], summary: { totalLocked: 0, totalPnl: 0, activeCount: 0 } });
  }

  let totalLocked = 0;
  let totalPnl    = 0;
  let activeCount = 0;

  // Fetch live WSOMI price once to avoid multiple RPC calls
  let wsomiPrice = 0.114;
  try {
    wsomiPrice = await getWsomiPrice();
  } catch (err) {
    console.error('Failed to get WSOMI price, using fallback', err);
  }

  const enrichedVaults = await Promise.all(
    vaults.map(async (vault) => {
      const locked = Number(vault.ausdcLocked);
      totalLocked += locked;
      if (vault.status === 'ACTIVE') activeCount++;

      // Fetch open positions on-chain for this vault
      let onChainPositions: any[] = [];
      try {
        const openIds = await client.readContract({
          address: VAULT_MANAGER,
          abi: VAULT_ABI_ABI,
          functionName: 'getOpenPositions',
          args: [follower as `0x${string}`, vault.leader as `0x${string}`],
        });

        onChainPositions = await Promise.all(
          openIds.map(async (id) => {
            const pos = await client.readContract({
              address: VAULT_MANAGER,
              abi: VAULT_ABI_ABI,
              functionName: 'positions',
              args: [id],
            });

            // pos is [follower, leader, vaultId, token, ausdAllocated, entryPrice, exitPrice, pnl, status, openedAt, closedAt]
            const tokenAddress = pos[3] as string;
            const ausdcAllocated = Number(pos[4]) / 1e6;
            const entryPrice = Number(pos[5]) / 1e10;
            const openedAt = new Date(Number(pos[9]) * 1000).toISOString();

            const currentPrice = await getLivePrice(tokenAddress, wsomiPrice);
            const unrealizedPnl = entryPrice > 0
              ? (ausdcAllocated * currentPrice) / entryPrice - ausdcAllocated
              : 0;

            const symbol = ADDRESS_TO_SYMBOL[tokenAddress.toLowerCase()] ?? 'UNKNOWN';

            return {
              id,
              token: symbol,
              tokenAddress,
              ausdcAllocated,
              entryPrice,
              currentPrice: +currentPrice.toFixed(6),
              unrealizedPnl: +unrealizedPnl.toFixed(6),
              status: 'OPEN',
              openedAt,
              leader: vault.leader,
            };
          })
        );
      } catch (err) {
        console.error(`Failed to fetch on-chain positions for leader ${vault.leader}:`, err);
      }

      const vaultPnl = onChainPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      totalPnl += vaultPnl;

      return {
        ...vault,
        ausdcLocked: locked,
        positions: onChainPositions,
        unrealizedPnl: +vaultPnl.toFixed(6),
      };
    })
  );

  return NextResponse.json({
    vaults: enrichedVaults,
    summary: {
      totalLocked: +totalLocked.toFixed(6),
      totalPnl:    +totalPnl.toFixed(6),
      activeCount,
    },
  });
}
