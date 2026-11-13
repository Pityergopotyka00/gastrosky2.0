# Maxima stock synchronization — NOT ENABLED

The separate Cloudflare Worker in `worker/index.js` is an experimental monitor. It is not deployed, and it has not yet successfully demonstrated extraction of real stock data.

## Before enabling
1. Ask Maxima for a reseller API, XML/CSV inventory feed, or permission for automated page checking. Prefer the official supplier feed.
2. Confirm the actual product HTML, handling location, currency, login-dependent availability, and JS-rendered state.
3. Run parser tests against authorized sample HTML and verify against the supplier's visible status.
4. Create a Cloudflare D1 database, run `worker/schema.sql`, replace the placeholder `database_id` in wrangler.jsonc.
5. Deploy in an independent Cloudflare Worker, leaving gastrosky.hu untouched.
6. Set `ENABLE_STOCK_SYNC=true` only when authorized and verified.

Cron is configured at 5-minute intervals but **disabled by default**.

On any fetch/parse error, the API stores `unknown` rather than claiming stock. The `checked_at` timestamp means *last attempted check*, not necessarily a successful observation. The client should show `Ellenőrzés alatt` for unknown and should not assert a live status from a screenshot.

Supplier product page markup and language may change without notice. Treat HTML scraping as a temporary proof-of-concept, not a supported long-term integration.
