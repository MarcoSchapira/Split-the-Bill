ALTER TABLE "bill_shares"
  ADD COLUMN "payer_marked_as_paid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lender_confirmed_paid" BOOLEAN NOT NULL DEFAULT false;

UPDATE "bill_shares"
SET
  "payer_marked_as_paid" = true,
  "lender_confirmed_paid" = true
WHERE "settlement_status" = 'PAID'::"BillShareSettlementStatus"
   OR "settled_at" IS NOT NULL;

ALTER TABLE "bill_shares" DROP COLUMN "settled_at";
ALTER TABLE "bill_shares" DROP COLUMN "settlement_status";

DROP TYPE "BillShareSettlementStatus";
