-- Group deletion should preserve the activity feed entry. The nullable group
-- reference is cleared so clients can render the event without linking to a
-- destination that no longer exists.
ALTER TABLE "activity_events"
  DROP CONSTRAINT "activity_events_group_id_fkey";

ALTER TABLE "activity_events"
  ADD CONSTRAINT "activity_events_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
