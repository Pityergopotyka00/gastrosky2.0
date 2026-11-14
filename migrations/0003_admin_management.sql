-- Dashboard-managed changes, separate from immutable supplier import data.
CREATE TABLE IF NOT EXISTS admin_product_overrides (
 product_id TEXT PRIMARY KEY NOT NULL,
 custom_name TEXT,
 custom_description TEXT,
 image_url TEXT,
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
 featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_settings (
 key TEXT PRIMARY KEY NOT NULL,
 value TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_quote_notes (
 id TEXT PRIMARY KEY NOT NULL,
 customer_name TEXT NOT NULL,
 customer_email TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','done')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_quote_notes_status_idx ON admin_quote_notes(status,updated_at);
