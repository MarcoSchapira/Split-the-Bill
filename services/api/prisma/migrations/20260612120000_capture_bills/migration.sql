-- Capture bill schema extensions
ALTER TABLE bills ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE bills ADD COLUMN receipt_metadata JSONB;

CREATE TABLE bill_line_items (
  id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  CONSTRAINT bill_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT bill_line_items_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE INDEX bill_line_items_bill_id_idx ON bill_line_items(bill_id);

CREATE TABLE bill_line_item_assignments (
  id TEXT NOT NULL,
  line_item_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  CONSTRAINT bill_line_item_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT bill_line_item_assignments_line_item_id_fkey FOREIGN KEY (line_item_id) REFERENCES bill_line_items(id) ON DELETE CASCADE,
  CONSTRAINT bill_line_item_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT bill_line_item_assignments_line_item_id_user_id_key UNIQUE (line_item_id, user_id)
);

CREATE INDEX bill_line_item_assignments_line_item_id_idx ON bill_line_item_assignments(line_item_id);
CREATE INDEX bill_line_item_assignments_user_id_idx ON bill_line_item_assignments(user_id);

CREATE INDEX bills_source_idx ON bills(source);

-- Helper: user has a share on a capture bill
CREATE OR REPLACE FUNCTION app_has_bill_share(target_bill_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM bill_shares bs
    WHERE bs.bill_id = target_bill_id AND bs.user_id = app_current_user_id()
  );
$$ LANGUAGE sql STABLE;

-- Update bills RLS to include capture bills
DROP POLICY IF EXISTS bills_all ON bills;

CREATE POLICY bills_all ON bills FOR ALL USING (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = bills.friendship_id
      AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
  )
  OR app_is_group_member(group_id)
  OR (target_type = 'capture' AND app_has_bill_share(id))
) WITH CHECK (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = bills.friendship_id
      AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
  )
  OR app_is_group_member(group_id)
  OR (target_type = 'capture' AND app_has_bill_share(id))
);

-- Update bill_shares RLS to include capture bills
DROP POLICY IF EXISTS bill_shares_all ON bill_shares;

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
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id
      AND b.target_type = 'capture'
      AND app_has_bill_share(b.id)
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
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_shares.bill_id
      AND b.target_type = 'capture'
      AND app_has_bill_share(b.id)
  )
);

-- Bill line items RLS
ALTER TABLE bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_items FORCE ROW LEVEL SECURITY;

CREATE POLICY bill_line_items_all ON bill_line_items FOR ALL USING (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_line_items.bill_id
      AND (
        b.creator_id = app_current_user_id()
        OR EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.id = b.friendship_id
            AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
        )
        OR app_is_group_member(b.group_id)
        OR (b.target_type = 'capture' AND app_has_bill_share(b.id))
      )
  )
) WITH CHECK (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_line_items.bill_id
      AND (
        b.creator_id = app_current_user_id()
        OR EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.id = b.friendship_id
            AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
        )
        OR app_is_group_member(b.group_id)
        OR (b.target_type = 'capture' AND app_has_bill_share(b.id))
      )
  )
);

-- Bill line item assignments RLS
ALTER TABLE bill_line_item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_item_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY bill_line_item_assignments_all ON bill_line_item_assignments FOR ALL USING (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM bill_line_items bli
    JOIN bills b ON b.id = bli.bill_id
    WHERE bli.id = bill_line_item_assignments.line_item_id
      AND (
        b.creator_id = app_current_user_id()
        OR EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.id = b.friendship_id
            AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
        )
        OR app_is_group_member(b.group_id)
        OR (b.target_type = 'capture' AND app_has_bill_share(b.id))
      )
  )
) WITH CHECK (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1 FROM bill_line_items bli
    JOIN bills b ON b.id = bli.bill_id
    WHERE bli.id = bill_line_item_assignments.line_item_id
      AND (
        b.creator_id = app_current_user_id()
        OR EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.id = b.friendship_id
            AND (f.user_a_id = app_current_user_id() OR f.user_b_id = app_current_user_id())
        )
        OR app_is_group_member(b.group_id)
        OR (b.target_type = 'capture' AND app_has_bill_share(b.id))
      )
  )
);
