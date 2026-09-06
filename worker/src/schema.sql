DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS item_log;
DROP TABLE IF EXISTS user_products;
DROP TABLE IF EXISTS households;

CREATE TABLE households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id TEXT NOT NULL,
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
    household_id TEXT NOT NULL,
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

CREATE TABLE user_products (
    barcode TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    image_url TEXT
);

CREATE INDEX idx_items_household ON items(household_id);
CREATE INDEX idx_items_location ON items(location);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_expiry_date ON items(expiry_date);
CREATE INDEX idx_item_log_household ON item_log(household_id);
CREATE INDEX idx_item_log_reason ON item_log(reason);
CREATE INDEX idx_item_log_removed_at ON item_log(removed_at);
CREATE INDEX idx_user_products_household ON user_products(household_id);
