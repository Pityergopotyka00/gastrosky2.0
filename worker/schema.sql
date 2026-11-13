CREATE TABLE IF NOT EXISTS stock_current (
  sku TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'unknown',
  quantity INTEGER,
  expected_date TEXT,
  reason TEXT,
  checked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  kind TEXT NOT NULL,
  quantity INTEGER,
  expected_date TEXT,
  reason TEXT,
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_checks_sku_time ON stock_checks(sku, checked_at DESC);
