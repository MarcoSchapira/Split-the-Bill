ALTER TABLE "activity_events" ADD COLUMN "friendship_id" TEXT;

CREATE INDEX "activity_events_friendship_id_idx" ON "activity_events"("friendship_id");

ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_friendship_id_fkey"
  FOREIGN KEY ("friendship_id") REFERENCES "friendships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
