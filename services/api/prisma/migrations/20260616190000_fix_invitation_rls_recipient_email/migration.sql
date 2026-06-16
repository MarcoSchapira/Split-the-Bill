-- Allow recipients to see and respond to email-only invitations before recipient_id is set.

DROP POLICY IF EXISTS friend_invitations_all ON friend_invitations;

CREATE POLICY friend_invitations_all ON friend_invitations FOR ALL USING (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
  OR (
    recipient_id IS NULL
    AND recipient_email = (
      SELECT u.email FROM users u WHERE u.id = app_current_user_id()
    )
  )
) WITH CHECK (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
  OR (
    recipient_id IS NULL
    AND recipient_email = (
      SELECT u.email FROM users u WHERE u.id = app_current_user_id()
    )
  )
);

DROP POLICY IF EXISTS group_invitations_all ON group_invitations;

CREATE POLICY group_invitations_all ON group_invitations FOR ALL USING (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
  OR app_is_group_member(group_id)
  OR (
    recipient_id IS NULL
    AND recipient_email = (
      SELECT u.email FROM users u WHERE u.id = app_current_user_id()
    )
  )
) WITH CHECK (
  app_bypass_rls()
  OR sender_id = app_current_user_id()
  OR recipient_id = app_current_user_id()
  OR app_is_group_member(group_id)
  OR (
    recipient_id IS NULL
    AND recipient_email = (
      SELECT u.email FROM users u WHERE u.id = app_current_user_id()
    )
  )
);

-- Repair invitations that were stored as email-only even though the recipient already had an account.
UPDATE friend_invitations fi
SET recipient_id = u.id
FROM users u
WHERE fi.recipient_id IS NULL
  AND fi.recipient_email = u.email
  AND fi.status = 'pending';

UPDATE group_invitations gi
SET recipient_id = u.id
FROM users u
WHERE gi.recipient_id IS NULL
  AND gi.recipient_email = u.email
  AND gi.status = 'pending';
