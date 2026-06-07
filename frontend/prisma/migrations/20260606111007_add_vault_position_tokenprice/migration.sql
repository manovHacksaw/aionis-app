-- CreateTable
CREATE TABLE "vaults" (
    "address" TEXT NOT NULL,
    "virtual_usdc" DECIMAL(20,6) NOT NULL,
    "starting_capital" DECIMAL(20,6) NOT NULL,
    "copy_model_key" TEXT NOT NULL DEFAULT 'fixed_available_pct',
    "copy_model_config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower" TEXT NOT NULL,
    "leader" TEXT NOT NULL,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower","leader")
);

-- CreateTable
CREATE TABLE "leader_swaps" (
    "id" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "token_in" TEXT NOT NULL,
    "token_out" TEXT NOT NULL,
    "usd_value" DECIMAL(20,6) NOT NULL,
    "wsomi_price" DECIMAL(20,10) NOT NULL,
    "tx_hash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_swaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_trades" (
    "id" TEXT NOT NULL,
    "follower" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usdc_spent" DECIMAL(20,6) NOT NULL,
    "token_amount" DECIMAL(30,10) NOT NULL,
    "entry_price" DECIMAL(20,10) NOT NULL,
    "exit_price" DECIMAL(20,10),
    "pnl" DECIMAL(20,6),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "tx_hash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vaults" (
    "id" TEXT NOT NULL,
    "follower" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "ausdc_locked" DECIMAL(20,6) NOT NULL,
    "risk_level" INTEGER NOT NULL,
    "max_per_trade_pct" INTEGER NOT NULL,
    "allowlist_json" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "on_chain_vault_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "follower" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "ausdc_allocated" DECIMAL(20,6) NOT NULL,
    "entry_price" DECIMAL(20,10) NOT NULL,
    "exit_price" DECIMAL(20,10),
    "pnl" DECIMAL(20,6),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "tx_hash_open" TEXT,
    "tx_hash_close" TEXT,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_prices" (
    "token" TEXT NOT NULL,
    "price" DECIMAL(20,10) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_prices_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "leader_swaps_leader_timestamp_idx" ON "leader_swaps"("leader", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "user_vaults_follower_idx" ON "user_vaults"("follower");

-- CreateIndex
CREATE INDEX "user_vaults_leader_idx" ON "user_vaults"("leader");

-- CreateIndex
CREATE UNIQUE INDEX "user_vaults_follower_leader_key" ON "user_vaults"("follower", "leader");

-- CreateIndex
CREATE INDEX "positions_follower_status_idx" ON "positions"("follower", "status");

-- CreateIndex
CREATE INDEX "positions_leader_status_idx" ON "positions"("leader", "status");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_fkey" FOREIGN KEY ("follower") REFERENCES "vaults"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_follower_fkey" FOREIGN KEY ("follower") REFERENCES "vaults"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "user_vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
