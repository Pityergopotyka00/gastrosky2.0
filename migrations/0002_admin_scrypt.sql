-- One-time migration for existing accounts. Run this in the PRIVATE D1 Console.
-- Legacy PBKDF2 users remain blocked until an owner performs their
-- private local scrypt hash migration; no plaintext secrets are stored.
ALTER TABLE admin_users ADD COLUMN password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256';
