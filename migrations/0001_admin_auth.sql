-- Private GastroSky admin identity and session tables.
-- Never include real email addresses, passwords, TOTP secrets or session tokens here.
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('owner','editor')),
  password_salt TEXT NOT NULL CHECK(length(password_salt)=64),
  password_hash TEXT NOT NULL CHECK(length(password_hash)=64),
  password_iterations INTEGER NOT NULL DEFAULT 600000 CHECK(password_iterations >= 600000),
  totp_encrypted TEXT NOT NULL,
  last_totp_step INTEGER NOT NULL DEFAULT -1,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
  csrf_hash TEXT NOT NULL CHECK(length(csrf_hash)=64),
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  event TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  detail TEXT,
  FOREIGN KEY(actor_id) REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_occurred_idx ON admin_audit_log(occurred_at);
