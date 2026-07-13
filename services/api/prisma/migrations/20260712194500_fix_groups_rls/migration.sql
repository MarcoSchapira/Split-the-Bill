-- Fix groups RLS: allow creators to see/insert their group before membership row exists.
-- Prisma nested create runs INSERT ... RETURNING on groups before group_members is inserted.

DROP POLICY IF EXISTS "groups_select" ON "groups";
CREATE POLICY "groups_select" ON "groups" FOR SELECT USING (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_is_group_member(id)
);

DROP POLICY IF EXISTS "groups_insert" ON "groups";
CREATE POLICY "groups_insert" ON "groups" FOR INSERT WITH CHECK (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
);

DROP POLICY IF EXISTS "groups_update" ON "groups";
CREATE POLICY "groups_update" ON "groups" FOR UPDATE USING (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_is_group_member(id)
) WITH CHECK (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_is_group_member(id)
);
