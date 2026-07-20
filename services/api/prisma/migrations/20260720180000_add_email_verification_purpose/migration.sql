-- AlterTable
ALTER TABLE "email_verifications" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'registration';

-- CreateIndex
CREATE INDEX "email_verifications_email_purpose_idx" ON "email_verifications"("email", "purpose");
