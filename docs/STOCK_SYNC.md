# GastroSky 2.0 — Maxima and HENDI product + stock sync

## What is configured now
- `data/catalog-products.json`: starter catalog (17 products with manufacturer image URLs).
- `data/supplier-stock-snapshot.json`: stock values only after a source has been checked.
- `index.html` fetches the catalog and snapshots automatically. Customers **cannot trigger a supplier request** and do not see delivery estimates.
- `scripts/check-public-supplier-stock.mjs`: scheduled, cautious, robots.txt-aware checks of publicly accessible product pages for products already known to the catalog.
- `scripts/discover-public-maxima.mjs`: discover additional Maxima products from Hungarian public category pages, requiring page-verified SKU and manufacturer image before importing; nightly rotating capped batches. The workflow skips crawling when robots policy cannot be verified. It never fabricates stock or bypasses restricted access.
- `.github/workflows/refresh-public-supplier-stock.yml`: scheduled every three hours, with a push trigger for the first workflow test.
- `.github/workflows/discover-public-maxima.yml`: nightly product discovery and photo import, plus push-triggered initial attempt.
- `scripts/sync-supplier-feeds.mjs`: imports complete catalog and warehouse availability **when supplier-authorized XML/CSV/JSON feeds exist**.
- `.github/workflows/sync-supplier-feeds.yml`: scheduled every two hours.
- `scripts/copy-static.mjs`: publishes product + stock snapshots into Cloudflare static assets on deployment.
- `worker/index.js`: serves a read-only stock and product API from snapshots, with freshness limits. **No D1 database is required.**

## IMPORTANT: Status and prerequisites
The GitHub automation is wired up, but it does not mean live synchronization has been proven. An empty `data/supplier-stock-snapshot.json` means no product status has been checked successfully and committed.

**Complete Maxima + HENDI catalogs are not currently included.** For full coverage and reliable vendor warehouse data, arrange official reseller feeds. Maxima explicitly provides XML/CSV files and marketing photos upon request to registered dealers. HENDI wholesale integration is also documented to use authorized product files, which may include photos and warehouse stock.

## Obtain supplier feed URLs and connect
1. Request the dealer catalog feed **with images, SKU/EAN, and stock values** from Maxima and HENDI (ask if stock is included; not all product feeds have inventory).
2. When they provide downloadable HTTPS feed URLs, save them as repository **Actions secrets**:
   - `MAXIMA_FEED_URL`
   - `HENDI_FEED_URL`
   Do **not** paste passwords or protected URLs in source files or public chats.
3. Repository → Actions → **Sync authorized Maxima and HENDI feeds** → Run workflow.
4. Check the logs for how many products and explicit warehouse stock values were imported. If the supplier feed uses different XML fields, adapt `scripts/sync-supplier-feeds.mjs` to its exact schema.
5. Successful workflow commits will trigger the connected Cloudflare Worker deployment. Verify `/api/health` reports a positive number of `verified_fresh_records`.
6. Check a few SKUs against each supplier's authorized reseller inventory interface.

Only unambiguous stock statuses display **Készleten** or **Nincs készleten**. Unknown, blocked, missing, or stale data displays **Elérhetőség egyeztetés alapján**.

## Scaling and privacy
- Public page checks are a limited fallback for known products, not a substitute for vendor-provided full catalog feeds.
- The public page checker respects supplier robots.txt and rate-limits itself.
- No confidential supplier buying prices are imported or publicly published.
- Product images are linked from the manufacturers' sites; confirm reseller image usage permissions.
