-- Tighten group_members INSERT: only self-join or admin bypass (no member adding arbitrary users)
DROP POLICY IF EXISTS group_members_insert ON group_members;

CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
);
