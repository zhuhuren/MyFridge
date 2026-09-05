CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    barcode TEXT,
    category TEXT DEFAULT 'Other',
    location TEXT NOT NULL DEFAULT 'fridge',
    quantity INTEGER DEFAULT 1,
    date_added TEXT NOT NULL,
    expiry_date TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    category TEXT,
    location TEXT,
    reason TEXT NOT NULL,
    removed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_expiry_date ON items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_item_log_reason ON item_log(reason);
CREATE INDEX IF NOT EXISTS idx_item_log_removed_at ON item_log(removed_at);
