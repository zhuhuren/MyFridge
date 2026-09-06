DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS item_log;

CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    barcode TEXT,
    category TEXT DEFAULT 'Other',
    location TEXT NOT NULL DEFAULT 'fridge',
    quantity REAL DEFAULT 1,
    initial_quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    unit_cost REAL,
    date_added TEXT NOT NULL,
    expiry_date TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE item_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    category TEXT,
    location TEXT,
    reason TEXT NOT NULL,
    logged_quantity REAL,
    unit TEXT,
    cost_value REAL,
    percentage REAL,
    removed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_items_location ON items(location);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_expiry_date ON items(expiry_date);
CREATE INDEX idx_item_log_reason ON item_log(reason);
CREATE INDEX idx_item_log_removed_at ON item_log(removed_at);
