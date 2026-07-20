-- Convert boolean consent flag to nullable timestamp (records when consent was given).
ALTER TABLE "users" ADD COLUMN "ai_receipt_consent_at" TIMESTAMP(3);

UPDATE "users"
SET "ai_receipt_consent_at" = NOW()
WHERE "ai_receipt_processing_consented" = true;

ALTER TABLE "users" DROP COLUMN "ai_receipt_processing_consented";
