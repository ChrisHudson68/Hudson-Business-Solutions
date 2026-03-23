ALTER TABLE estimate_line_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0;
ALTER TABLE estimate_line_items ADD COLUMN upcharge_percent REAL NOT NULL DEFAULT 0;
ALTER TABLE estimate_line_items ADD COLUMN apply_upcharge INTEGER NOT NULL DEFAULT 1;

UPDATE estimate_line_items
SET unit_cost = COALESCE(unit_price, 0),
    upcharge_percent = 0,
    apply_upcharge = 1
WHERE unit_cost = 0 AND upcharge_percent = 0;
