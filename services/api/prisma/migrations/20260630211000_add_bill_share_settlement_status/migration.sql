CREATE TYPE "BillShareSettlementStatus" AS ENUM ('NOT_PAID', 'PENDING', 'PAID');

ALTER TABLE "bill_shares"
  ADD COLUMN "settlement_status" "BillShareSettlementStatus" NOT NULL DEFAULT 'NOT_PAID';

UPDATE "bill_shares"
SET "settlement_status" = CASE
  WHEN "settled_at" IS NOT NULL THEN 'PAID'::"BillShareSettlementStatus"
  ELSE 'NOT_PAID'::"BillShareSettlementStatus"
END;
