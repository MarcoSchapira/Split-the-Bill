-- Groups table
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_key" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "groups_creator_id_idx" ON "groups"("creator_id");

ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_fkey"
  FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Group members table
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bill group columns
ALTER TABLE "bills" ADD COLUMN "is_split_with_group" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bills" ADD COLUMN "group_id" TEXT;

CREATE INDEX "bills_group_id_idx" ON "bills"("group_id");

ALTER TABLE "bills" ADD CONSTRAINT "bills_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Activity events group column
ALTER TABLE "activity_events" ADD COLUMN "group_id" TEXT;

CREATE INDEX "activity_events_group_id_idx" ON "activity_events"("group_id");

ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restore group helper functions (after tables exist)
CREATE OR REPLACE FUNCTION app_is_group_member(target_group_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = app_current_user_id()
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_shares_group_with(target_user_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = app_current_user_id() AND gm2.user_id = target_user_id
  );
$$ LANGUAGE sql STABLE;

-- Users can see co-group members
DROP POLICY IF EXISTS "users_select" ON "users";
CREATE POLICY "users_select" ON "users" FOR SELECT USING (
  app_bypass_rls()
  OR "id" = app_current_user_id()
  OR app_shares_friendship_with("id")
  OR app_shares_group_with("id")
);

-- Groups RLS
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;

CREATE POLICY "groups_select" ON "groups" FOR SELECT USING (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_is_group_member(id)
);

CREATE POLICY "groups_insert" ON "groups" FOR INSERT WITH CHECK (
  app_bypass_rls() OR creator_id = app_current_user_id()
);

CREATE POLICY "groups_update" ON "groups" FOR UPDATE USING (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_is_group_member(id)
) WITH CHECK (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_is_group_member(id)
);

CREATE POLICY "groups_delete" ON "groups" FOR DELETE USING (
  app_bypass_rls() OR creator_id = app_current_user_id()
);

-- Group members RLS
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" FORCE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select" ON "group_members" FOR SELECT USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_is_group_member(group_id)
);

CREATE POLICY "group_members_insert" ON "group_members" FOR INSERT WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_is_group_member(group_id)
);

CREATE POLICY "group_members_delete" ON "group_members" FOR DELETE USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id AND g.creator_id = app_current_user_id()
  )
);
