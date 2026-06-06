'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useState } from 'react';
import AUSD_ABI from '@/contracts/artifacts/contracts/aUSD.sol/aUSD.json';

const AUSD_ADDRESS = (process.env.NEXT_PUBLIC_AUSDC_ADDRESS ?? '') as `0x${string}`;
const VAULT_MANAGER = (process.env.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS ?? '') as `0x${string}`;

// aUSD has 6 decimals (same as USDC)
const DECIMALS = 6;

export function useAUSD() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [faucetTxHash,  setFaucetTxHash]  = useState<`0x${string}` | undefined>();
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();

  // ── Reads ──────────────────────────────────────────────────────────────────

  // How many aUSD this wallet holds
  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address:      AUSD_ADDRESS,
    abi:          AUSD_ABI.abi,
    functionName: 'balanceOf',
    args:         [address ?? '0x0'],
    query:        { enabled: !!address, refetchInterval: 10_000 },
  });

  // How many aUSD VaultManager is currently allowed to pull
  const { data: rawAllowance, refetch: refetchAllowance } = useReadContract({
    address:      AUSD_ADDRESS,
    abi:          AUSD_ABI.abi,
    functionName: 'allowance',
    args:         [address ?? '0x0', VAULT_MANAGER],
    query:        { enabled: !!address, refetchInterval: 10_000 },
  });

  // Seconds until the address can call faucet() again (0 = can claim now)
  const { data: rawCooldown } = useReadContract({
    address:      AUSD_ADDRESS,
    abi:          AUSD_ABI.abi,
    functionName: 'faucetCooldownRemaining',
    args:         [address ?? '0x0'],
    query:        { enabled: !!address, refetchInterval: 15_000 },
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const balance  = rawBalance  ? Number(formatUnits(rawBalance  as bigint, DECIMALS)) : 0;
  const allowance = rawAllowance ? Number(formatUnits(rawAllowance as bigint, DECIMALS)) : 0;
  const cooldownSeconds = rawCooldown ? Number(rawCooldown as bigint) : 0;
  const canFaucet = cooldownSeconds === 0;

  // ── Transaction receipts (to know when tx mines) ───────────────────────────

  const { isLoading: faucetPending } = useWaitForTransactionReceipt({
    hash: faucetTxHash,
    query: {
      enabled: !!faucetTxHash,
      // Refetch balance once the faucet tx confirms
    },
  });

  const { isLoading: approvePending } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // ── Write functions ────────────────────────────────────────────────────────

  // Claims 10,000 aUSD — 24h cooldown enforced on-chain
  async function claimFaucet() {
    const hash = await writeContractAsync({
      address:      AUSD_ADDRESS,
      abi:          AUSD_ABI.abi,
      functionName: 'faucet',
    });
    setFaucetTxHash(hash);
    return hash;
  }

  // Approves VaultManager to spend `amount` aUSD on behalf of this wallet.
  // Called automatically inside useVault.createVault() before the vault tx.
  // Can also be called standalone to pre-approve a larger allowance.
  async function approve(amountHuman: number) {
    const hash = await writeContractAsync({
      address:      AUSD_ADDRESS,
      abi:          AUSD_ABI.abi,
      functionName: 'approve',
      args:         [VAULT_MANAGER, parseUnits(amountHuman.toString(), DECIMALS)],
    });
    setApproveTxHash(hash);
    return hash;
  }

  // Returns true if VaultManager already has enough allowance for `amount`
  function hasEnoughAllowance(amountHuman: number) {
    return allowance >= amountHuman;
  }

  function refetch() {
    refetchBalance();
    refetchAllowance();
  }

  return {
    // State
    balance,
    allowance,
    cooldownSeconds,
    canFaucet,
    // Loading flags
    faucetPending,
    approvePending,
    // Actions
    claimFaucet,
    approve,
    hasEnoughAllowance,
    refetch,
  };
}
