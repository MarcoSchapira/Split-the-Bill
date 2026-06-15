-- Break RLS recursion between activity_events and activity_recipients.
-- Each policy previously queried the other table, causing infinite recursion on inserts.

CREATE OR REPLACE FUNCTION app_user_is_activity_recipient(p_event_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM activity_recipients ar
    WHERE ar.event_id = p_event_id
      AND ar.user_id = app_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION app_user_is_activity_actor(p_event_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM activity_events ae
    WHERE ae.id = p_event_id
      AND ae.actor_id = app_current_user_id()
  );
$$;

DROP POLICY IF EXISTS activity_events_all ON activity_events;

CREATE POLICY activity_events_all ON activity_events FOR ALL USING (
  app_bypass_rls()
  OR actor_id = app_current_user_id()
  OR app_user_is_activity_recipient(id)
) WITH CHECK (
  app_bypass_rls()
  OR actor_id = app_current_user_id()
);

DROP POLICY IF EXISTS activity_recipients_all ON activity_recipients;

CREATE POLICY activity_recipients_all ON activity_recipients FOR ALL USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_user_is_activity_actor(event_id)
) WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_user_is_activity_actor(event_id)
);
