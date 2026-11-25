CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt BLOB NOT NULL, password BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS sellers (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt BLOB NOT NULL, password BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS buyer_sessions (
    token BLOB PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS seller_sessions (
    token BLOB PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL UNIQUE REFERENCES sellers(id), name TEXT NOT NULL, description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id),
    name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, image TEXT NOT NULL,
    price INTEGER NOT NULL CHECK(price > 0), stock INTEGER NOT NULL CHECK(stock >= 0)
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY, buyer_id INTEGER NOT NULL REFERENCES buyers(id),
    request_key TEXT NOT NULL, request_hash BLOB NOT NULL, recipient TEXT NOT NULL,
    postal_code TEXT NOT NULL, address TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(buyer_id, request_key)
);
CREATE TABLE IF NOT EXISTS order_lines (
    order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id),
    store_id INTEGER NOT NULL REFERENCES stores(id), product_name TEXT NOT NULL, store_name TEXT NOT NULL,
    unit_price INTEGER NOT NULL CHECK(unit_price > 0), quantity INTEGER NOT NULL CHECK(quantity > 0),
    PRIMARY KEY(order_id, product_id)
);
CREATE INDEX IF NOT EXISTS order_lines_by_store ON order_lines(store_id, order_id);
CREATE TABLE IF NOT EXISTS seed_runs (name TEXT PRIMARY KEY);
