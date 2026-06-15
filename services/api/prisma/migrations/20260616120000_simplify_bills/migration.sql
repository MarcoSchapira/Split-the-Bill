-- Remove capture-specific bill data and simplify schema
DELETE FROM bills WHERE target_type = 'capture';

DROP TABLE IF EXISTS bill_line_item_assignments;
DROP TABLE IF EXISTS bill_line_items;

ALTER TABLE bills DROP COLUMN IF EXISTS receipt_metadata;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE bills RENAME COLUMN updated_at TO last_edited_at;
  END IF;
END $$;

-- Drop policies before the helper they depend on
DROP POLICY IF EXISTS bills_all ON bills;
DROP POLICY IF EXISTS bill_shares_all ON bill_shares;

DROP FUNCTION IF EXISTS app_has_bill_share(text);

-- Revert bills RLS to friendship/group only

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

-- Revert bill_shares RLS to friendship/group only
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
