# GastroSky Admin: security-first implementation

## Current status (do not describe as production-ready)

The Worker contains a private authentication **API foundation**. A visual admin
dashboard has NOT yet been published. There is no public administrator signup,
password reset, or permission-changing endpoint. All `/admin` and
`/api/admin/*` requests are intercepted by the Worker before static assets.
Routes fail closed until the owner configures the private database and secrets.

**Do not deploy admin write permissions before a separate security review.**
This is a starting security layer, not a guarantee of immunity from intrusion.

## Controls implemented

- Email/password login AND authenticator-app TOTP (six digits, 30-second window, one-use step).
- PBKDF2-HMAC-SHA256 with 600,000 iterations and a random per-user 32-byte salt; no plaintext passwords are stored. Consider migrating to Argon2id using a reviewed implementation if the runtime supports it.
- Encrypted TOTP seeds at rest using AES-256-GCM; master key is held in Cloudflare Worker secrets and must never go into GitHub.
- Secure HttpOnly SameSite=Strict host-only session cookie with a random 256-bit token; only SHA-256 token digests are stored in D1.
- Session idle expiry after 30 minutes, hard expiry after 8 hours, server-side revocation on logout.
- Same-origin checks for state changes, and a separate per-session CSRF token.
- Approximate Cloudflare-native login rate limit (5 requests / minute / visitor IP / location) plus a per-user lockout after five failures for 15 minutes.
- Generic login failure responses, private/no-store responses, anti-framing, and minimal account information.
- Owner/editor role schema, but no administrative write actions before explicit server-side permissions and audit rules exist.
- Audit records for login success/failure and logout (no credentials, token, or TOTP contents).

## Required owner-controlled configuration

1. Using the authorized business Cloudflare account, create a **new private D1 database** named `gastrosky-admin` (do not use a public asset or a GitHub JSON file).
2. Add the following D1 binding to `wrangler.jsonc`, replacing the ID with the real one shown by Cloudflare. Do not use a placeholder ID in a live deployment:

   ```json
   "d1_databases": [{
     "binding": "ADMIN_DB",
     "database_name": "gastrosky-admin",
     "database_id": "REPLACE_WITH_YOUR_OWN_D1_DATABASE_ID",
     "migrations_dir": "migrations"
   }]
   ```

3. Apply `migrations/0001_admin_auth.sql` to that database using the official D1 migration tool, and check that the three admin tables exist.
4. Generate a random **32-byte AES key** using a trusted local password/key manager; base64 encode it and configure it exclusively as a Cloudflare Worker secret named `ADMIN_TOTP_KEY` with `npx wrangler secret put ADMIN_TOTP_KEY`. Do **not** put it in the `vars` section or send it through chat.
5. On a trusted owner's computer, set `ADMIN_SETUP_EMAIL`, a unique strong `ADMIN_SETUP_PASSWORD`, `ADMIN_SETUP_ROLE` (owner or editor) and the same `ADMIN_TOTP_KEY` in the local process environment, then run `node scripts/provision-admin.mjs`. The command writes two temporary private files: a SQL enrollment statement and an authenticator enrollment URI. No account is created remotely by this command.
6. Privately import the generated SQL statement into the D1 database using the authorized Cloudflare CLI. Enroll your authenticator via the private enrollment URI using a trusted QR generator or the manual secret. Test the login and securely delete the temporary enrollment files. Never commit or publish them.
7. Add one account per authorized person. Never share account credentials or authenticator seeds. Use a hardware-backed authenticator when practical, and protect all Cloudflare/GitHub accounts with MFA.

The native login rate limit binding is already included in `wrangler.jsonc`. If it or D1 is absent, login is disabled rather than unprotected.

## API contracts for future admin interface

- `POST /api/admin/login`: JSON `{email,password,code}`, with same-origin `Origin` and `Content-Type: application/json`. If successful, sends HttpOnly session cookie and JSON with short-lived CSRF token.
- `GET /api/admin/session`: requires a valid session cookie; issues a new CSRF token for authenticated browsing after reload.
- `POST /api/admin/logout`: requires session cookie, same-origin `Origin`, and `x-csrf-token` header; revokes current session.
- All other admin routes currently return 404, including public registration, account reset, product edits, staff management, file uploads, and arbitrary SQL.

## Still required before real admin launch

- Branded admin login UI, explicitly tested with proper error messages, account recovery and owner-approved recovery codes. Do not publish the admin UI until the full login lifecycle has been tested end to end.
- Server-side **per-route** roles for products, promos, images and staff, plus audit logs on every modification.
- D1 schema/version migrations and backups, clear disaster-recovery, key rotation, account disable/revoke-all-sessions, alerts, monitoring, and login anomaly detection.
- Strong upload pipeline: private R2 bucket, content type and magic byte verification, strict file size caps, malware scan, safe image re-encoding, and signed upload rules.
- Edge WAF managed rules for `/admin/*`, `/api/admin/*`, and unusual bursts; managed challenge as needed. Cloudflare native rate limiter is approximate and per location.
- Automated integration and adversarial security tests, user acceptance tests, external security audit, incident response plan, and periodic updates.
- Configure *no-store* caching rules on admin endpoints at the CDN, strict admin page CSP, avoid third-party scripts, check all dependencies, use Cloudflare account least-privilege and MFA.
- The public repository and public catalog still allow copying publicly delivered website content; admin authentication does not change that.

**No security design can offer 100% protection.** The focus is to minimize attack surfaces, protect secrets, enforce least privilege, and fail closed until the system is ready.
