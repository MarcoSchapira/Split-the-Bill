-- Remove group features end-to-end.
-- This migration is destructive by design because no production users/data exist.

-- Remove group-linked activity and bill targeting markers.
DELETE FROM "activity_events"
WHERE "group_invitation_id" IS NOT NULL
   OR "type" IN ('GROUP_INVITATION_SENT', 'GROUP_INVITATION_ACCEPTED', 'GROUP_INVITATION_DECLINED');

UPDATE "bills"
SET "group_id" = NULL,
    "target_type" = NULL
WHERE "group_id" IS NOT NULL OR "target_type" = 'group';

-- Drop policies/functions that depend on group tables.
DROP POLICY IF EXISTS "users_select" ON "users";
CREATE POLICY "users_select" ON "users" FOR SELECT USING (
  app_bypass_rls()
  OR "id" = app_current_user_id()
  OR app_shares_friendship_with("id")
);

-- Remove activity_events group-invitation relation.
ALTER TABLE "activity_events" DROP CONSTRAINT IF EXISTS "activity_events_group_invitation_id_fkey";
DROP INDEX IF EXISTS "activity_events_group_invitation_id_idx";
ALTER TABLE "activity_events" DROP COLUMN IF EXISTS "group_invitation_id";

-- Remove group invitation table and related constraints/policies/indexes.
DROP POLICY IF EXISTS "group_invitations_all" ON "group_invitations";
DROP INDEX IF EXISTS "group_invitations_group_id_idx";
DROP INDEX IF EXISTS "group_invitations_sender_id_idx";
DROP INDEX IF EXISTS "group_invitations_recipient_id_idx";
DROP INDEX IF EXISTS "group_invitations_recipient_email_idx";
DROP INDEX IF EXISTS "group_invitations_status_idx";
DROP INDEX IF EXISTS "group_invitations_pending_email_unique";
ALTER TABLE "group_invitations" DROP CONSTRAINT IF EXISTS "group_invitations_recipient_check";
DROP TABLE IF EXISTS "group_invitations";

-- Remove group member table and related policies/indexes.
DROP POLICY IF EXISTS "group_members_select" ON "group_members";
DROP POLICY IF EXISTS "group_members_insert" ON "group_members";
DROP POLICY IF EXISTS "group_members_delete" ON "group_members";
DROP INDEX IF EXISTS "group_members_group_id_idx";
DROP INDEX IF EXISTS "group_members_user_id_idx";
DROP INDEX IF EXISTS "group_members_group_id_user_id_key";
DROP TABLE IF EXISTS "group_members";

-- Remove bills.group_id relation and index.
ALTER TABLE "bills" DROP CONSTRAINT IF EXISTS "bills_group_id_fkey";
DROP INDEX IF EXISTS "bills_group_id_idx";
ALTER TABLE "bills" DROP COLUMN IF EXISTS "group_id";

-- Remove groups table and related policies.
DROP POLICY IF EXISTS "groups_select" ON "groups";
DROP POLICY IF EXISTS "groups_insert" ON "groups";
DROP POLICY IF EXISTS "groups_update" ON "groups";
DROP TABLE IF EXISTS "groups";

-- Remove helper functions once dependent policies are gone.
DROP FUNCTION IF EXISTS app_is_group_member(text);
DROP FUNCTION IF EXISTS app_shares_group_with(text);
