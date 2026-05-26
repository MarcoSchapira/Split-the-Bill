ALTER TABLE "users"
    ALTER COLUMN "name" DROP NOT NULL,
    ALTER COLUMN "password_hash" DROP NOT NULL,
    ADD COLUMN "auth_provider" TEXT NOT NULL DEFAULT 'local',
    ADD COLUMN "provider_user_id" TEXT,
    ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "users"
SET "updated_at" = CURRENT_TIMESTAMP
WHERE "updated_at" IS NULL;

ALTER TABLE "users"
    ALTER COLUMN "updated_at" SET NOT NULL;
