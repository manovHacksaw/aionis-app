-- AlterTable: add granular per-agent trade filters (VaultManager v6)
-- USD bound fields use 0 as a "no limit" sentinel.
ALTER TABLE "user_vaults"
  ADD COLUMN "slippage_bps"          INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "min_leader_trade_usd"  DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN "max_leader_trade_usd"  DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN "min_alloc_usd"         DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN "max_alloc_usd"         DECIMAL(20,6) NOT NULL DEFAULT 0;
