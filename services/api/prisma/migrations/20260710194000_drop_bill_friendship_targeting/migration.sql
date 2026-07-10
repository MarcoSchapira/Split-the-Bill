-- Drop bill targeting columns and activity friendship link.
-- Bills are scoped by bill_shares participants only.

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_friendship_id_fkey;
DROP INDEX IF EXISTS bills_friendship_id_idx;
ALTER TABLE bills DROP COLUMN IF EXISTS friendship_id;
ALTER TABLE bills DROP COLUMN IF EXISTS target_type;

ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_friendship_id_fkey;
DROP INDEX IF EXISTS activity_events_friendship_id_idx;
ALTER TABLE activity_events DROP COLUMN IF EXISTS friendship_id;
