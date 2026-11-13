-- GastroSky 2.0 – D1 current availability snapshot.
-- Only the scheduled Worker writes these rows; visitors can only read them.
CREATE TABLE IF NOT EXISTS supplier_stock (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK (kind IN ('unknown','in_stock','out_of_stock','low_stock','expected','out_of_assortment')),
 quantity INTEGER,
 expected_date TEXT,
 reason TEXT,
 checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_checked_at ON supplier_stock(checked_at);
