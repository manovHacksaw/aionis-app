-- CreateTable: cache NL explanations for agent activity feed entries
CREATE TABLE "trade_explanations" (
    "request_id"  TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_explanations_pkey" PRIMARY KEY ("request_id")
);
