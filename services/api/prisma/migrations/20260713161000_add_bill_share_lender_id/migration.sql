-- AlterTable
ALTER TABLE "bill_shares" ADD COLUMN "lender_id" TEXT;

-- Backfill from parent bill payer
UPDATE "bill_shares"
SET "lender_id" = "bills"."payer_id"
FROM "bills"
WHERE "bills"."id" = "bill_shares"."bill_id";

-- AlterTable
ALTER TABLE "bill_shares" ALTER COLUMN "lender_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "bill_shares_lender_id_idx" ON "bill_shares"("lender_id");

-- AddForeignKey
ALTER TABLE "bill_shares" ADD CONSTRAINT "bill_shares_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
