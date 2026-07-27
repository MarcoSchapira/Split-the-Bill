-- Tighten collaborator write guards while preserving:
-- - any bill participant editing bill content (amounts, line items, shareCents/lenderId)
-- - dual-ack settlement (debtor marks paid; lender confirms)
-- - any group member renaming/updating icon
-- - creator-driven ownership transfer on leave/delete
-- - creator-only group member management

-- ---------------------------------------------------------------------------
-- bill_shares: split policies + settlement column guard
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_shares_all ON bill_shares;

CREATE POLICY bill_shares_select ON bill_shares FOR SELECT USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_has_bill_share(bill_id)
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id AND b.creator_id = app_current_user_id()
  )
);

-- Participants rewrite amounts in place; only creators insert shares for others
-- (bill create / retarget / recreate). Own-row insert covers edge cases.
CREATE POLICY bill_shares_insert ON bill_shares FOR INSERT WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id AND b.creator_id = app_current_user_id()
  )
);

-- Any participant may update share amounts / lender on co-participant rows.
-- Settlement flag changes are enforced by the trigger below.
CREATE POLICY bill_shares_update ON bill_shares FOR UPDATE USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_has_bill_share(bill_id)
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id AND b.creator_id = app_current_user_id()
  )
) WITH CHECK (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_has_bill_share(bill_id)
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id AND b.creator_id = app_current_user_id()
  )
);

CREATE POLICY bill_shares_delete ON bill_shares FOR DELETE USING (
  app_bypass_rls()
  OR user_id = app_current_user_id()
  OR app_has_bill_share(bill_id)
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id AND b.creator_id = app_current_user_id()
  )
);

CREATE OR REPLACE FUNCTION bill_shares_settlement_guard()
RETURNS trigger AS $$
DECLARE
  bill_payer text;
  current_uid text := app_current_user_id();
BEGIN
  IF app_bypass_rls() THEN
    RETURN NEW;
  END IF;

  -- Bill content edits update shareCents / lender_id and preserve settlement flags.
  IF NEW.payer_marked_as_paid IS NOT DISTINCT FROM OLD.payer_marked_as_paid
     AND NEW.lender_confirmed_paid IS NOT DISTINCT FROM OLD.lender_confirmed_paid THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'bill share user cannot be reassigned'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  SELECT payer_id INTO bill_payer FROM bills WHERE id = NEW.bill_id;

  -- Debtor marks / unmarks paid on their own share only.
  IF NEW.user_id = current_uid
     AND NEW.user_id IS DISTINCT FROM bill_payer
     AND NEW.payer_marked_as_paid IS DISTINCT FROM OLD.payer_marked_as_paid
     AND NEW.lender_confirmed_paid IS NOT DISTINCT FROM OLD.lender_confirmed_paid THEN
    RETURN NEW;
  END IF;

  -- Lender confirms / unconfirms on a debtor share only.
  IF bill_payer = current_uid
     AND NEW.user_id IS DISTINCT FROM current_uid
     AND NEW.lender_confirmed_paid IS DISTINCT FROM OLD.lender_confirmed_paid
     AND NEW.payer_marked_as_paid IS NOT DISTINCT FROM OLD.payer_marked_as_paid THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'settlement update not allowed for this actor'
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bill_shares_settlement_guard ON bill_shares;
CREATE TRIGGER bill_shares_settlement_guard
  BEFORE UPDATE ON bill_shares
  FOR EACH ROW
  EXECUTE FUNCTION bill_shares_settlement_guard();

-- ---------------------------------------------------------------------------
-- groups: only current creator (or bypass) may change creator_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION groups_creator_change_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW.creator_id IS NOT DISTINCT FROM OLD.creator_id THEN
    RETURN NEW;
  END IF;

  IF app_bypass_rls() THEN
    RETURN NEW;
  END IF;

  -- Ownership transfer runs as the departing creator under withUserContext.
  IF OLD.creator_id = app_current_user_id() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'only the group creator can transfer ownership'
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS groups_creator_change_guard ON groups;
CREATE TRIGGER groups_creator_change_guard
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION groups_creator_change_guard();

-- ---------------------------------------------------------------------------
-- group_members: only the group creator may insert members
-- (self-insert on create still works because creator_id is the actor)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS group_members_insert ON group_members;
CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id AND g.creator_id = app_current_user_id()
  )
);

-- ---------------------------------------------------------------------------
-- receipt_parse_rate_limits: fail closed for the app role (admin/bypass only)
-- ---------------------------------------------------------------------------
ALTER TABLE receipt_parse_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_parse_rate_limits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipt_parse_rate_limits_all ON receipt_parse_rate_limits;
CREATE POLICY receipt_parse_rate_limits_all ON receipt_parse_rate_limits FOR ALL USING (
  app_bypass_rls()
) WITH CHECK (
  app_bypass_rls()
);
