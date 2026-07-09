ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "friendship_id" TEXT;

CREATE INDEX IF NOT EXISTS "activity_events_friendship_id_idx" ON "activity_events"("friendship_id");

DO $$
BEGIN
  ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_friendship_id_fkey"
    FOREIGN KEY ("friendship_id") REFERENCES "friendships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
