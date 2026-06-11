-- Helper functions for RLS policies (TEXT ids match Prisma String columns)
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean AS $$
  SELECT current_setting('app.bypass_rls', true) = 'true';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_shares_friendship_with(target_user_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE (f.user_a_id = app_current_user_id() AND f.user_b_id = target_user_id)
       OR (f.user_b_id = app_current_user_id() AND f.user_a_id = target_user_id)
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_shares_group_with(target_user_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = app_current_user_id() AND gm2.user_id = target_user_id
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_group_member(target_group_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = app_current_user_id()
  );
$$ LANGUAGE sql STABLE;

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_select ON users FOR SELECT USING (
  app_bypass_rls()
  OR id = app_current_user_id()
  OR app_shares_friendship_with(id)
  OR app_shares_group_with(id)
);

CREATE POLICY users_modify ON users FOR ALL USING (
  app_bypass_rls() OR id = app_current_user_id()
) WITH CHECK (
  app_bypass_rls() OR id = app_current_user_id()
);

-- Sessions (app admin bypass for auth service)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY sessions_all ON sessions FOR ALL USING (
  app_bypass_rls() OR user_id = app_current_user_id()
) WITH CHECK (
  app_bypass_rls() OR user_id = app_current_user_id()
);

-- Groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;

CREATE POLICY groups_select ON groups FOR SELECT USING (
  app_bypass_rls() OR app_is_group_member(id)
);

CREATE POLICY groups_insert ON groups FOR INSERT WITH CHECK (
  app_bypass_rls() OR app_current_user_id() IS NOT NULL
);

CREATE POLICY groups_update ON groups FOR UPDATE USING (
  app_bypass_rls() OR app_is_group_member(id)
) WITH CHECK (
  app_bypass_rls() OR app_is_group_member(id)
);

-- Group members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members FORCE ROW LEVEL SECURITY;

CREATE POLICY group_members_select ON group_members FOR SELECT USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_is_group_member(group_id)
);

CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_is_group_member(group_id)
);

CREATE POLICY group_members_delete ON group_members FOR DELETE USING (
  app_bypass_rls() OR user_id = app_current_user_id()
);

-- Friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships FORCE ROW LEVEL SECURITY;

CREATE POLICY friendships_all ON friendships FOR ALL USING (
  app_bypass_rls()
  OR user_a_id = app_current_user_id()
  OR user_b_id = app_current_user_id()
) WITH CHECK (
  app_bypass_rls()
  OR user_a_id = app_current_user_id()
  OR user_b_id = app_current_user_id()
);

-- Friend invitations
ALTER TABLE friend_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY friend_invitations_all ON friend_invitations FOR ALL USING (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
) WITH CHECK (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
);

-- Group invitations
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY group_invitations_all ON group_invitations FOR ALL USING (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
  OR app_is_group_member(group_id)
) WITH CHECK (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
  OR app_is_group_member(group_id)
);

-- Bills
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills FORCE ROW LEVEL SECURITY;

CREATE POLICY bills_all ON bills FOR ALL USING (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = bills.friendship_id
      AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
  )
  OR app_is_group_member(group_id)
) WITH CHECK (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = bills.friendship_id
      AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
  )
  OR app_is_group_member(group_id)
);

-- Bill shares
ALTER TABLE bill_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_shares FORCE ROW LEVEL SECURITY;

CREATE POLICY bill_shares_all ON bill_shares FOR ALL USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM bills b
    JOIN friendships f ON f.id = b.friendship_id
    WHERE b.id = bill_shares.bill_id
      AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
  )
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id AND app_is_group_member(b.group_id)
  )
) WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM bills b
    JOIN friendships f ON f.id = b.friendship_id
    WHERE b.id = bill_shares.bill_id
      AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
  )
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id AND app_is_group_member(b.group_id)
  )
);

-- Activity events
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events FORCE ROW LEVEL SECURITY;

CREATE POLICY activity_events_all ON activity_events FOR ALL USING (
  app_bypass_rls()
  OR actor_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM activity_recipients ar
    WHERE ar.event_id = activity_events.id AND ar.user_id = app_current_user_id()
  )
) WITH CHECK (
  app_bypass_rls()
  OR actor_id = app_current_user_id()
);

-- Activity recipients
ALTER TABLE activity_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_recipients FORCE ROW LEVEL SECURITY;

CREATE POLICY activity_recipients_all ON activity_recipients FOR ALL USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM activity_events ae
    WHERE ae.id = activity_recipients.event_id AND ae.actor_id = app_current_user_id()
  )
) WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM activity_events ae
    WHERE ae.id = activity_recipients.event_id AND ae.actor_id = app_current_user_id()
  )
);
