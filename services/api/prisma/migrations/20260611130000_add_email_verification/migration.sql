-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Backfill existing users as verified
UPDATE "users" SET "email_verified_at" = NOW() WHERE "email_verified_at" IS NULL;

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verifications_email_idx" ON "email_verifications"("email");

-- RLS: admin-only access (auth service uses prismaAdmin bypass)
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications FORCE ROW LEVEL SECURITY;

CREATE POLICY email_verifications_all ON email_verifications FOR ALL USING (
  app_bypass_rls()
) WITH CHECK (
  app_bypass_rls()
);
