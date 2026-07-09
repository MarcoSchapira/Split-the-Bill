ALTER TABLE "bills"
  ADD COLUMN "is_one_main_total" BOOLEAN,
  ADD COLUMN "is_split_with_friends" BOOLEAN,
  ADD COLUMN "is_split_by_final_amounts" BOOLEAN;

UPDATE "bills" b
SET
  "is_one_main_total" = NOT EXISTS (
    SELECT 1
    FROM "bill_line_items" li
    WHERE li."bill_id" = b."id"
  ),
  "is_split_with_friends" = (
    SELECT COUNT(*)
    FROM "bill_shares" bs
    WHERE bs."bill_id" = b."id"
  ) > 1,
  "is_split_by_final_amounts" = NOT EXISTS (
    SELECT 1
    FROM "bill_line_items" li
    JOIN "bill_line_item_assignments" lia ON lia."line_item_id" = li."id"
    WHERE li."bill_id" = b."id"
  );

ALTER TABLE "bills"
  ALTER COLUMN "is_one_main_total" SET DEFAULT TRUE,
  ALTER COLUMN "is_one_main_total" SET NOT NULL,
  ALTER COLUMN "is_split_with_friends" SET DEFAULT FALSE,
  ALTER COLUMN "is_split_with_friends" SET NOT NULL,
  ALTER COLUMN "is_split_by_final_amounts" SET DEFAULT TRUE,
  ALTER COLUMN "is_split_by_final_amounts" SET NOT NULL;
