-- Receipt-centric bills: persist full parsed receipt data and participant-level access

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS store_name TEXT,
  ADD COLUMN IF NOT EXISTS store_address TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS receipt_date TEXT,
  ADD COLUMN IF NOT EXISTS receipt_time TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS card_last_4 TEXT,
  ADD COLUMN IF NOT EXISTS item_count INTEGER,
  ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER,
  ADD COLUMN IF NOT EXISTS tax_cents INTEGER,
  ADD COLUMN IF NOT EXISTS tip_cents INTEGER;

ALTER TABLE bills
  ALTER COLUMN target_type DROP NOT NULL;

CREATE TABLE IF NOT EXISTS bill_line_items (
  id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  CONSTRAINT bill_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT bill_line_items_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS bill_line_items_bill_id_idx ON bill_line_items(bill_id);

CREATE TABLE IF NOT EXISTS bill_line_item_assignments (
  id TEXT NOT NULL,
  line_item_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  CONSTRAINT bill_line_item_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT bill_line_item_assignments_line_item_id_fkey FOREIGN KEY (line_item_id) REFERENCES bill_line_items(id) ON DELETE CASCADE,
  CONSTRAINT bill_line_item_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS bill_line_item_assignments_line_item_id_user_id_key
  ON bill_line_item_assignments(line_item_id, user_id);
CREATE INDEX IF NOT EXISTS bill_line_item_assignments_line_item_id_idx
  ON bill_line_item_assignments(line_item_id);
CREATE INDEX IF NOT EXISTS bill_line_item_assignments_user_id_idx
  ON bill_line_item_assignments(user_id);

-- Keep historical bills if friendship/group records are later removed
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_friendship_id_fkey;
ALTER TABLE bills ADD CONSTRAINT bills_friendship_id_fkey
  FOREIGN KEY (friendship_id) REFERENCES friendships(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_group_id_fkey;
ALTER TABLE bills ADD CONSTRAINT bills_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Helper: user has a share on a bill
CREATE OR REPLACE FUNCTION app_has_bill_share(target_bill_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM bill_shares bs
    WHERE bs.bill_id = target_bill_id AND bs.user_id = app_current_user_id()
  );
$$ LANGUAGE sql STABLE;

-- Bills become participant-visible (or creator-visible)
DROP POLICY IF EXISTS bills_all ON bills;
CREATE POLICY bills_all ON bills FOR ALL USING (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_has_bill_share(id)
) WITH CHECK (
  app_bypass_rls()
  OR creator_id = app_current_user_id()
  OR app_has_bill_share(id)
);

-- Bill shares follow participant visibility
DROP POLICY IF EXISTS bill_shares_all ON bill_shares;
CREATE POLICY bill_shares_all ON bill_shares FOR ALL USING (
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

ALTER TABLE bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bill_line_items_all ON bill_line_items;
CREATE POLICY bill_line_items_all ON bill_line_items FOR ALL USING (
  app_bypass_rls()
  OR app_has_bill_share(bill_id)
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_line_items.bill_id AND b.creator_id = app_current_user_id()
  )
) WITH CHECK (
  app_bypass_rls()
  OR app_has_bill_share(bill_id)
  OR EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_line_items.bill_id AND b.creator_id = app_current_user_id()
  )
);

ALTER TABLE bill_line_item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_item_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bill_line_item_assignments_all ON bill_line_item_assignments;
CREATE POLICY bill_line_item_assignments_all ON bill_line_item_assignments FOR ALL USING (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1
    FROM bill_line_items li
    JOIN bills b ON b.id = li.bill_id
    WHERE li.id = bill_line_item_assignments.line_item_id
      AND (
        app_has_bill_share(li.bill_id)
        OR b.creator_id = app_current_user_id()
      )
  )
) WITH CHECK (
  app_bypass_rls()
  OR EXISTS (
    SELECT 1
    FROM bill_line_items li
    JOIN bills b ON b.id = li.bill_id
    WHERE li.id = bill_line_item_assignments.line_item_id
      AND (
        app_has_bill_share(li.bill_id)
        OR b.creator_id = app_current_user_id()
      )
  )
);
