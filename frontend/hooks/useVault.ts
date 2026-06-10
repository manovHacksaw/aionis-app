'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseUnits, keccak256, encodePacked } from 'viem';
import { useState, useEffect } from 'react';
import { useAUSD } from '@/hooks/useAUSD';
import VAULT_ABI from '@/contracts/artifacts/contracts/VaultManager.sol/VaultManager.json';

const VAULT_MANAGER  = (process.env.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS ?? '') as `0x${string}`;
const KEEPER_ADDRESS = (process.env.NEXT_PUBLIC_KEEPER_ADDRESS ?? '') as `0x${string}`;
const DECIMALS = 6;

function computeVaultId(follower: `0x${string}`, leader: `0x${string}`) {
  return keccak256(encodePacked(['address', 'address'], [follower, leader]));
}

export function useVault(leaderAddress?: `0x${string}`) {
  const { address: follower } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { approve, hasEnoughAllowance, refetch: refetchAUSD } = useAUSD();

  const [createTxHash,   setCreateTxHash]   = useState<`0x${string}` | undefined>();
  const [depositTxHash,  setDepositTxHash]  = useState<`0x${string}` | undefined>();
  const [withdrawTxHash, setWithdrawTxHash] = useState<`0x${string}` | undefined>();
  const [closeTxHash,    setCloseTxHash]    = useState<`0x${string}` | undefined>();

  const vaultId = follower && leaderAddress
    ? computeVaultId(follower, leaderAddress)
    : undefined;

  const enabled = !!follower && !!leaderAddress;

  // ── Reads ──────────────────────────────────────────────────────────────────

  const { data: vaultData, refetch: refetchVault } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getVault',
    args:         [follower ?? '0x0', leaderAddress ?? '0x0'],
    query:        { enabled, refetchInterval: 15_000 },
  });

  // Contract signature: getOpenPositions(address follower, address leader)
  const { data: openPositionIds, refetch: refetchPositions } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getOpenPositions',
    args:         [follower ?? '0x0', leaderAddress ?? '0x0'],
    query:        { enabled, refetchInterval: 15_000 },
  });


  // Contract signature: getFreeBalance(address follower, address leader)
  const { data: rawFreeBalance } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getFreeBalance',
    args:         [follower ?? '0x0', leaderAddress ?? '0x0'],
    query:        { enabled, refetchInterval: 15_000 },
  });

  // Contract signature: getAllowlist(address follower, address leader)
  const { data: allowlist } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'getAllowlist',
    args:         [follower ?? '0x0', leaderAddress ?? '0x0'],
    query:        { enabled },
  });

  // keeperOf(follower) — check if keeper is already set
  const { data: currentKeeper, refetch: refetchKeeper } = useReadContract({
    address:      VAULT_MANAGER,
    abi:          VAULT_ABI.abi,
    functionName: 'keeperOf',
    args:         [follower ?? '0x0'],
    query:        { enabled: !!follower, refetchInterval: 30_000 },
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const vault = vaultData as {
    ausdLocked: bigint; riskLevel: number; maxPerTradePct: number;
    status: number; keeper: `0x${string}`;
  } | undefined;

  const [unrealizedPnL, setUnrealizedPnL] = useState<number | null>(null);

  useEffect(() => {
    if (!follower || !leaderAddress || !openPositionIds || !publicClient) {
      setUnrealizedPnL(0);
      return;
    }

    let active = true;

    async function fetchPnL() {
      try {
        let total = 0;
        const ids = openPositionIds as readonly `0x${string}`[];
        
        for (const id of ids) {
          const pos = await publicClient!.readContract({
            address: VAULT_MANAGER,
            abi: VAULT_ABI.abi,
            functionName: 'positions',
            args: [id],
          }) as any;

          const tokenAddress = pos[3] as string;
          const ausdAllocated = Number(pos[4]) / 1e6;
          const entryPrice = Number(pos[5]) / 1e10;

          if (entryPrice > 0) {
            const res = await fetch(`/api/price/${tokenAddress}`);
            const data = await res.json();
            if (data.price) {
              const currentPrice = Number(data.price);
              const pnl = (ausdAllocated * currentPrice) / entryPrice - ausdAllocated;
              total += pnl;
            }
          }
        }
        
        if (active) {
          setUnrealizedPnL(+total.toFixed(6));
        }
      } catch (err) {
        console.error('Error calculating client-side unrealized PnL:', err);
      }
    }

    fetchPnL();
    const interval = setInterval(fetchPnL, 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [follower, leaderAddress, openPositionIds, publicClient]);

  const freeBalance    = rawFreeBalance  !== undefined ? Number(rawFreeBalance as bigint) / 10 ** DECIMALS : null;
  const lockedBalance  = vault ? Number(vault.ausdLocked) / 10 ** DECIMALS : null;

  // status: 0 = ACTIVE, 1 = PAUSED, 2 = CLOSED
  const vaultStatus = vault ? (['ACTIVE', 'PAUSED', 'CLOSED'] as const)[vault.status] : null;

  const keeperSet = !!(currentKeeper && (currentKeeper as string).toLowerCase() === KEEPER_ADDRESS.toLowerCase());

  // ── Transaction receipts ───────────────────────────────────────────────────

  const { isLoading: createPending }   = useWaitForTransactionReceipt({ hash: createTxHash });
  const { isLoading: depositPending }  = useWaitForTransactionReceipt({ hash: depositTxHash });
  const { isLoading: withdrawPending } = useWaitForTransactionReceipt({ hash: withdrawTxHash });
  const { isLoading: closePending }    = useWaitForTransactionReceipt({ hash: closeTxHash });

  // ── Write functions ────────────────────────────────────────────────────────

  // tokens must be token addresses (0x...) — NOT symbols
  // limits: human-readable values; USD fields use 0 as "no limit" sentinel
  async function createVault({
    amountHuman,
    riskLevel,
    maxPerTradePct,
    tokens,
    limits,
  }: {
    amountHuman:    number;
    riskLevel:      number;
    maxPerTradePct: number;
    tokens:         `0x${string}`[];
    limits: {
      slippageBps:       number;
      minLeaderTradeUsd: number;
      maxLeaderTradeUsd: number;
      minAllocUsd:       number;
      maxAllocUsd:       number;
      stopLossPct:       number;
    };
  }) {
    if (!follower || !leaderAddress) throw new Error('wallet not connected');

    // Step 1: approve if needed — wait for receipt before createVault
    if (!hasEnoughAllowance(amountHuman)) {
      const approveHash = await approve(amountHuman);
      await publicClient!.waitForTransactionReceipt({ hash: approveHash });
      refetchAUSD();
    }

    const onChainLimits = {
      slippageBps:       limits.slippageBps,
      minLeaderTradeUsd: parseUnits(limits.minLeaderTradeUsd.toString(), DECIMALS),
      maxLeaderTradeUsd: parseUnits(limits.maxLeaderTradeUsd.toString(), DECIMALS),
      minAllocUsd:       parseUnits(limits.minAllocUsd.toString(), DECIMALS),
      maxAllocUsd:       parseUnits(limits.maxAllocUsd.toString(), DECIMALS),
    };

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
        onChainLimits,
      ],
    });
    setCreateTxHash(hash);

    // Step 3: wait for vault creation to confirm, then set keeper
    await publicClient!.waitForTransactionReceipt({ hash });
    if (KEEPER_ADDRESS && KEEPER_ADDRESS !== '0x') {
      try {
        await writeContractAsync({
          address:      VAULT_MANAGER,
          abi:          VAULT_ABI.abi,
          functionName: 'setKeeper',
          args:         [KEEPER_ADDRESS],
        });
        refetchKeeper();
      } catch (e) {
        console.warn('[useVault] setKeeper failed:', e);
      }
    }

    // Step 4: persist to DB — keepalive so navigation doesn't cancel the request
    fetch('/api/vaults', {
      method:   'POST',
      keepalive: true,
      headers:  { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        follower,
        leader:         leaderAddress,
        ausdLocked:     amountHuman,
        riskLevel,
        maxPerTradePct,
        allowlist:      tokens,
        onChainVaultId: vaultId,
        ...limits,
      }),
    }).catch(console.error);

    refetchAUSD();
    refetchVault();
    return hash;
  }

  // Reopen a previously-withdrawn (CLOSED) vault for this leader with a fresh deposit/config.
  async function reopenVault({
    amountHuman,
    riskLevel,
    maxPerTradePct,
    tokens,
    limits,
  }: {
    amountHuman:    number;
    riskLevel:      number;
    maxPerTradePct: number;
    tokens:         `0x${string}`[];
    limits: {
      slippageBps:       number;
      minLeaderTradeUsd: number;
      maxLeaderTradeUsd: number;
      minAllocUsd:       number;
      maxAllocUsd:       number;
      stopLossPct:       number;
    };
  }) {
    if (!follower || !leaderAddress) throw new Error('wallet not connected');

    // Step 1: approve if needed — wait for receipt before reopenVault
    if (!hasEnoughAllowance(amountHuman)) {
      const approveHash = await approve(amountHuman);
      await publicClient!.waitForTransactionReceipt({ hash: approveHash });
      refetchAUSD();
    }

    const onChainLimits = {
      slippageBps:       limits.slippageBps,
      minLeaderTradeUsd: parseUnits(limits.minLeaderTradeUsd.toString(), DECIMALS),
      maxLeaderTradeUsd: parseUnits(limits.maxLeaderTradeUsd.toString(), DECIMALS),
      minAllocUsd:       parseUnits(limits.minAllocUsd.toString(), DECIMALS),
      maxAllocUsd:       parseUnits(limits.maxAllocUsd.toString(), DECIMALS),
    };

    // Step 2: reopen the vault on-chain
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'reopenVault',
      args: [
        leaderAddress,
        parseUnits(amountHuman.toString(), DECIMALS),
        riskLevel,
        maxPerTradePct,
        tokens,
        onChainLimits,
      ],
    });
    setCreateTxHash(hash);

    // Step 3: wait for confirmation, then ensure keeper is still authorized
    await publicClient!.waitForTransactionReceipt({ hash });
    if (KEEPER_ADDRESS && KEEPER_ADDRESS !== '0x' && !keeperSet) {
      try {
        await writeContractAsync({
          address:      VAULT_MANAGER,
          abi:          VAULT_ABI.abi,
          functionName: 'setKeeper',
          args:         [KEEPER_ADDRESS],
        });
        refetchKeeper();
      } catch (e) {
        console.warn('[useVault] setKeeper failed:', e);
      }
    }

    // Step 4: persist to DB — keepalive so navigation doesn't cancel the request
    fetch('/api/vaults', {
      method:   'POST',
      keepalive: true,
      headers:  { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        follower,
        leader:         leaderAddress,
        ausdLocked:     amountHuman,
        riskLevel,
        maxPerTradePct,
        allowlist:      tokens,
        onChainVaultId: vaultId,
        ...limits,
      }),
    }).catch(console.error);

    refetchAUSD();
    refetchVault();
    return hash;
  }

  async function setKeeperManually() {
    if (!KEEPER_ADDRESS || KEEPER_ADDRESS === '0x') throw new Error('no keeper address configured');
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'setKeeper',
      args:         [KEEPER_ADDRESS],
    });
    await publicClient!.waitForTransactionReceipt({ hash });
    refetchKeeper();
    return hash;
  }

  async function deposit(amountHuman: number) {
    if (!follower || !leaderAddress) throw new Error('wallet not connected');
    if (!hasEnoughAllowance(amountHuman)) {
      const h = await approve(amountHuman);
      await publicClient!.waitForTransactionReceipt({ hash: h });
    }
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'deposit',
      args:         [leaderAddress, parseUnits(amountHuman.toString(), DECIMALS)],
    });
    setDepositTxHash(hash);
    refetchAUSD();
    refetchVault();
    return hash;
  }

  async function withdraw() {
    if (!follower || !leaderAddress) throw new Error('wallet not connected');
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'withdraw',
      args:         [leaderAddress],
    });
    setWithdrawTxHash(hash);
    refetchAUSD();
    refetchVault();
    return hash;
  }

  async function closePosition(positionId: `0x${string}`) {
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'closePosition',
      args:         [positionId],
    });
    setCloseTxHash(hash);
    refetchPositions();
    refetchVault();
    return hash;
  }

  async function pauseVault() {
    if (!leaderAddress) throw new Error('no leader');
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'pauseVault',
      args:         [leaderAddress],
    });
    await publicClient!.waitForTransactionReceipt({ hash });
    refetchVault();
    return hash;
  }

  async function resumeVault() {
    if (!leaderAddress) throw new Error('no leader');
    const hash = await writeContractAsync({
      address:      VAULT_MANAGER,
      abi:          VAULT_ABI.abi,
      functionName: 'resumeVault',
      args:         [leaderAddress],
    });
    await publicClient!.waitForTransactionReceipt({ hash });
    refetchVault();
    return hash;
  }

  function refetch() {
    refetchVault();
    refetchPositions();
    refetchKeeper();
  }

  return {
    vault,
    vaultId,
    vaultStatus,
    lockedBalance,
    freeBalance,
    unrealizedPnL,
    keeperSet,
    openPositionIds: openPositionIds as `0x${string}`[] | undefined,
    allowlist:       allowlist as `0x${string}`[] | undefined,
    createPending,
    depositPending,
    withdrawPending,
    closePending,
    createVault,
    reopenVault,
    setKeeperManually,
    deposit,
    withdraw,
    closePosition,
    pauseVault,
    resumeVault,
    refetch,
  };
}
