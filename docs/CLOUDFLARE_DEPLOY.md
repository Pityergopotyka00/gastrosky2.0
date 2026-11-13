# Cloudflare deployment of GastroSky 2.0

The connected Cloudflare Workers Build project name is `gastrosky2-0`.

## Website-only deployment (current)
`wrangler.jsonc` deliberately does **not** bind D1 yet, because the database has not been created. `ENABLE_STOCK_SYNC` is `false`, and the API reports no live availability. This should allow the Worker and website assets to deploy without Cloudflare error 10021.

## Enable stock database later
1. Cloudflare Dashboard → Storage & databases → D1 → Create database.
2. Name it `gastrosky2-stock`.
3. Initialize it with SQL from `worker/schema.sql` (D1 Console or Wrangler).
4. Copy the real D1 database UUID.
5. Add to `wrangler.jsonc`:

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "gastrosky2-stock",
    "database_id": "YOUR_REAL_DATABASE_UUID"
  }
]
```

Do not substitute a made-up UUID. The D1 UUID is a resource identifier, not a secret.
Set `ENABLE_STOCK_SYNC` to true **only after** a verified, authorized Maxima feed adapter is configured and tested. The current Worker expects a normalized authenticated JSON feed and does not yet support Maxima XML/CSV without a feed adapter.

## Expected result
Cloudflare Builds should run `npm run build` followed by `npx wrangler deploy`. Static pages should deploy with no D1 binding. An API call to `/api/stock` should report `enabled:false`, which is expected until database setup.
