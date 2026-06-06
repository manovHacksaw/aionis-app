/*
  Warnings:

  - Added the required column `token` to the `positions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "on_chain_position_id" TEXT,
ADD COLUMN     "token" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "positions_token_idx" ON "positions"("token");
