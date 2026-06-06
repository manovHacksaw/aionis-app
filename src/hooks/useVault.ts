'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, keccak256, encodePacked } from 'viem';
import { useState } from 'react';
import { useAUSD } from '@/hooks/useAUSD';
import VAULT_ABI from '@/contracts/artifacts/contracts/VaultManager.sol/VaultManager.json';

const VAULT_MANAGER = (process.env.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS ?? '') as `0x${string}`;
const DECIMALS = 6;

// Mirrors the on-chain vaultId(follower, leader) = keccak256(abi.encodePacked(follower, leader))
function computeVaultId(follower: `0x${string}`, leader: `0x${string}`) {
  return keccak256(encodePacked(['address', 'address'], [follower, leader]));
}

export function useVault(leaderAddress?: `0x${string}`) {
  const { address: follower } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { approve, hasEnoughAllowance, refetch: refetchAUSD } = useAUSD();

  const [createTxHash,  setCreateTxHash]  = useState<`0x${string}` | undefined>();
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | undefined>();
  const [withdrawTxHash, setWithdrawTxHash] = useState<`0x${string}` | undefined>();
  const [closeTxHash,   setCloseTxHash]   = useState<`0x${string}` | undefined>();

  const vaultId = follower && leaderAddress
    ? computeVaultId(follower, leaderAddress)
    : undefined;

  // ── Reads ──────────────────────────────────────────────────────────────────

  // Full vault state: ausdLocked, riskLevel, maxPerTradePct, status, keeper
  const { data: vaultData, refetch: refetchVault } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getVault',
    args:         [follower ?? '0x0', leaderAddress ?? '0x0'],
    query:        { enabled: !!follower && !!leaderAddress, refetchInterval: 15_000 },
  });

  // All open position IDs for this vault
  const { data: openPositionIds } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getOpenPositions',
    args:         [vaultId ?? '0x0'],
    query:        { enabled: !!vaultId, refetchInterval: 15_000 },
  });

  // Unrealized P&L in aUSD (6 decimals, signed — can be negative)
  const { data: rawPnL } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getUnrealizedPnL',
    args:         [follower ?? '0x0', leaderAddress ?? '0x0'],
    query:        { enabled: !!follower && !!leaderAddress, refetchInterval: 15_000 },
  });

  // How much aUSD is free (not locked in any open position)
  const { data: rawFreeBalance } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getFreeBalance',
    args:         [vaultId ?? '0x0'],
    query:        { enabled: !!vaultId, refetchInterval: 15_000 },
  });

  // Token allowlist for this vault
  const { data: allowlist } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getAllowlist',
    args:         [vaultId ?? '0x0'],
    query:        { enabled: !!vaultId },
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const vault = vaultData as {
    ausdLocked: bigint; riskLevel: number; maxPerTradePct: number;
    status: number; keeper: `0x${string}`;
  } | undefined;

  const unrealizedPnL = rawPnL !== undefined
    ? Number(rawPnL as bigint) / 10 ** DECIMALS
    : null;

  const freeBalance = rawFreeBalance !== undefined
    ? Number(rawFreeBalance as bigint) / 10 ** DECIMALS
    : null;

  const lockedBalance = vault
    ? Number(vault.ausdLocked) / 10 ** DECIMALS
    : null;

  // status: 0 = ACTIVE, 1 = PAUSED, 2 = CLOSED
  const vaultStatus = vault ? (['ACTIVE', 'PAUSED', 'CLOSED'] as const)[vault.status] : null;

  // ── Transaction receipts ───────────────────────────────────────────────────

  const { isLoading: createPending } = useWaitForTransactionReceipt({ hash: createTxHash });
  const { isLoading: depositPending } = useWaitForTransactionReceipt({ hash: depositTxHash });
  const { isLoading: withdrawPending } = useWaitForTransactionReceipt({ hash: withdrawTxHash });
  const { isLoading: closePending } = useWaitForTransactionReceipt({ hash: closeTxHash });

  // ── Write functions ────────────────────────────────────────────────────────

  // Full vault creation flow:
  // 1. If allowance is insufficient, approve VaultManager first
  // 2. Call createVault() on-chain
  // 3. Persist to DB via POST /api/vaults
  async function createVault({
    amountHuman,
    riskLevel,
    maxPerTradePct,
    tokens,
  }: {
    amountHuman:    number;
    riskLevel:      number;   // 1–5
    maxPerTradePct: number;   // e.g. 20 = 20%
    tokens:         string[]; // token symbols e.g. ["WSOMI", "USDC.e"]
  }) {
    if (!follower || !leaderAddress) throw new Error('wallet not connected');

    // Step 1: approve if needed
    if (!hasEnoughAllowance(amountHuman)) {
      const approveTx = await approve(amountHuman);
      // Wait briefly — wagmi tracks this via useWaitForTransactionReceipt
      // but we fire-and-continue since the next tx will queue anyway
      console.log('approve tx:', approveTx);
    }

    // Step 2: create vault on-chain
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'createVault',
      args: [
        leaderAddress,
        parseUnits(amountHuman.toString(), DECIMALS),
        riskLevel,
        maxPerTradePct,
        tokens,
      ],
    });
    setCreateTxHash(hash);

    // Step 3: persist to DB (fire and forget — we have the on-chain tx as source of truth)
    fetch('/api/vaults', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        follower,
        leader:         leaderAddress,
        ausdLocked:     amountHuman,
        riskLevel,
        maxPerTradePct,
        allowlist:      tokens,
        onChainVaultId: vaultId,
      }),
    }).catch(console.error);

    refetchAUSD();
    return hash;
  }

  // Add more aUSD to an existing vault (must approve first if needed)
  async function deposit(amountHuman: number) {
    if (!follower || !leaderAddress) throw new Error('wallet not connected');
    if (!hasEnoughAllowance(amountHuman)) await approve(amountHuman);

    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'deposit',
      args:         [leaderAddress, parseUnits(amountHuman.toString(), DECIMALS)],
    });
    setDepositTxHash(hash);
    refetchAUSD();
    return hash;
  }

  // Pull aUSD back out of the vault (only free balance, not locked in positions)
  async function withdraw(amountHuman: number) {
    if (!follower || !leaderAddress) throw new Error('wallet not connected');

    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'withdraw',
      args:         [leaderAddress, parseUnits(amountHuman.toString(), DECIMALS)],
    });
    setWithdrawTxHash(hash);
    refetchAUSD();
    return hash;
  }

  // Settles a specific open position on-chain.
  // Contract calculates P&L from latestPrice[token] / entryPrice,
  // mints profit (or deducts loss) in aUSD, marks position CLOSED.
  async function closePosition(positionId: `0x${string}`) {
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'closePosition',
      args:         [positionId],
    });
    setCloseTxHash(hash);
    return hash;
  }

  // Stop copying trades without withdrawing. Positions stay open.
  async function pauseVault() {
    if (!leaderAddress) throw new Error('no leader');
    return writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'pauseVault',
      args:         [leaderAddress],
    });
  }

  // Resume copying after a pause.
  async function resumeVault() {
    if (!leaderAddress) throw new Error('no leader');
    return writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'resumeVault',
      args:         [leaderAddress],
    });
  }

  // One-time delegation: lets the server wallet trigger trades on your behalf.
  // User calls this once; keeper wallet can then call checkLeaderActivity() for them.
  async function setKeeper(keeperAddress: `0x${string}`) {
    return writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'setKeeper',
      args:         [keeperAddress],
    });
  }

  // Add tokens to the vault's allowlist (which tokens it will copy trades for)
  async function addToAllowlist(tokens: string[]) {
    if (!leaderAddress) throw new Error('no leader');
    return writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'addToAllowlist',
      args:         [leaderAddress, tokens],
    });
  }

  // Remove tokens from the allowlist
  async function removeFromAllowlist(tokens: string[]) {
    if (!leaderAddress) throw new Error('no leader');
    return writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'removeFromAllowlist',
      args:         [leaderAddress, tokens],
    });
  }

  function refetch() {
    refetchVault();
  }

  return {
    // State
    vault,
    vaultId,
    vaultStatus,
    lockedBalance,
    freeBalance,
    unrealizedPnL,
    openPositionIds: openPositionIds as `0x${string}`[] | undefined,
    allowlist: allowlist as string[] | undefined,
    // Loading flags
    createPending,
    depositPending,
    withdrawPending,
    closePending,
    // Actions
    createVault,
    deposit,
    withdraw,
    closePosition,
    pauseVault,
    resumeVault,
    setKeeper,
    addToAllowlist,
    removeFromAllowlist,
    refetch,
  };
}
