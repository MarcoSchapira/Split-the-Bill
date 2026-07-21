-- Cloud Run may serve traffic from multiple instances, so receipt parsing
-- throttles need one shared, atomic counter rather than process memory.
CREATE TABLE "receipt_parse_rate_limits" (
  "key" TEXT NOT NULL,
  "hits" INTEGER NOT NULL,
  "reset_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "receipt_parse_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "receipt_parse_rate_limits_reset_at_idx"
  ON "receipt_parse_rate_limits"("reset_at");
