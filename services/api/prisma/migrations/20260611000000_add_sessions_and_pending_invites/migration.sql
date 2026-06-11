-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "friend_invitations" ALTER COLUMN "recipient_id" DROP NOT NULL;
ALTER TABLE "friend_invitations" ADD COLUMN "recipient_email" TEXT;

-- AlterTable
ALTER TABLE "group_invitations" ALTER COLUMN "recipient_id" DROP NOT NULL;
ALTER TABLE "group_invitations" ADD COLUMN "recipient_email" TEXT;

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");
CREATE INDEX "friend_invitations_recipient_email_idx" ON "friend_invitations"("recipient_email");
CREATE INDEX "group_invitations_recipient_email_idx" ON "group_invitations"("recipient_email");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints
ALTER TABLE "friend_invitations" ADD CONSTRAINT "friend_invitations_recipient_check"
  CHECK ("recipient_id" IS NOT NULL OR "recipient_email" IS NOT NULL);

ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_recipient_check"
  CHECK ("recipient_id" IS NOT NULL OR "recipient_email" IS NOT NULL);

-- Partial unique indexes for pending email invites
CREATE UNIQUE INDEX "friend_invitations_pending_email_unique"
  ON "friend_invitations" ("sender_id", "recipient_email")
  WHERE "status" = 'pending' AND "recipient_email" IS NOT NULL;

CREATE UNIQUE INDEX "group_invitations_pending_email_unique"
  ON "group_invitations" ("group_id", "recipient_email")
  WHERE "status" = 'pending' AND "recipient_email" IS NOT NULL;
