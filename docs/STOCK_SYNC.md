# GastroSky 2.0 — AUTOMATIC supplier stock checks

## Architecture
1. Cloudflare Worker cron wakes every five minutes.
2. The Worker selects a small rotating batch of Maxima and HENDI products.
3. It checks each *specific* supplier product URL and verifies the SKU.
4. When the supplier reports **in stock** or **out of stock**, that result is saved to D1. Where there is no unambiguous public stock state, the result is `unknown`.
5. The public website reads **only D1 saved records**. It never contacts supplier sites or lets customers trigger checks.

The storefront displays:
- `Készleten` for confirmed `in_stock` or `low_stock`;
- `Nincs készleten` for confirmed `out_of_stock`;
- `Kifutott termék` for confirmed `out_of_assortment`;
- `Elérhetőség egyeztetés alapján` for unknown, stale, expected delivery or other unverified cases.

**No delivery estimates are shown to customers.** Data older than one hour is considered stale. Stock data is supplier information, not GastroSky-owned stock.

## Activation — setup still required
Cloudflare Workers was previously deployed without a D1 binding, to avoid a failing build. The cron is present, but `ENABLE_SCHEDULED_SYNC` is deliberately `false`.

1. Cloudflare dashboard: **Storage & databases → D1 → Create database**, name `gastrosky2-stock`.
2. In the D1 database console, execute `worker/supplier-stock-schema.sql`.
3. In `wrangler.jsonc`, add the D1 binding:

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "gastrosky2-stock",
    "database_id": "<the actual database UUID from Cloudflare>"
  }
]
```

4. Before enabling automatic requests, get Maxima and HENDI reseller permission or their authorized stock feeds and test that their sites provide reliable SKU-matched status.
5. Set `ENABLE_SCHEDULED_SYNC` to `"true"` only after verification and redeploy.
6. Inspect `/api/health` and `/stock-monitor.html` on the Cloudflare preview.

## Scaling limits
The current batch checks **3 products every 5 minutes**, rotating across the small development catalog. It is not suitable for a supplier's full catalog of thousands of SKUs. For that, ingest authorized supplier inventory feeds in bulk; only URLs with permitted automated access should be checked individually. HENDI may not expose warehouse stock on its public product pages.

The mere existence of cron code or a supplier stock label in a search result does not demonstrate that this Worker has synchronized anything. A successful runtime check and stored D1 record are required before calling it live.
