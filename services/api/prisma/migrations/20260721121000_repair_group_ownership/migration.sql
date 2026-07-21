-- Repair groups orphaned before creator-departure handling was introduced.
-- Choose the same deterministic successor used by the application service.
-- Serialize the one-time repair with live group and membership writes.
BEGIN;

LOCK TABLE "groups" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "group_members" IN SHARE ROW EXCLUSIVE MODE;

WITH ranked_members AS (
  SELECT
    "group_id",
    "user_id",
    ROW_NUMBER() OVER (
      PARTITION BY "group_id"
      ORDER BY "joined_at" ASC, "user_id" ASC
    ) AS member_rank
  FROM "group_members"
)
UPDATE "groups" AS target_group
SET
  "creator_id" = successor."user_id",
  "updated_at" = CURRENT_TIMESTAMP
FROM ranked_members AS successor
WHERE successor."group_id" = target_group."id"
  AND successor.member_rank = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "group_members" AS creator_membership
    WHERE creator_membership."group_id" = target_group."id"
      AND creator_membership."user_id" = target_group."creator_id"
  );

-- Empty groups have no viable owner. Their bill references and group activity
-- references are cleared by the existing ON DELETE SET NULL constraints.
DELETE FROM "groups" AS target_group
WHERE NOT EXISTS (
  SELECT 1
  FROM "group_members" AS membership
  WHERE membership."group_id" = target_group."id"
);

COMMIT;
