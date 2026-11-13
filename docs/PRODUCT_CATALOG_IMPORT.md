# Product catalog import — Maxima + HENDI

## Goal
Import the publicly accessible manufacturer product assortment into the GastroSky 2.0 preview, with a real manufacturer-hosted photo per SKU. This is **not** inventory or warehouse-stock synchronization.

## Current implementation
- `scripts/discover-both-catalogs.mjs` discovers public category/product pages from the two manufacturers, with sitemap support where declared and permitted.
- Product pages are only included when a manufacturer SKU and a matching manufacturer-hosted product photo are present.
- `data/catalog-discovery-state.json` saves visited URLs and pending discovery pages between runs.
- `.github/workflows/discover-both-catalogs.yml` runs resumable discovery, with bounded batches and slow requests, automatically every two hours and via manual Actions dispatch.
- `data/catalog-products.json` contains the actual published products. The storefront loads this file dynamically with search, manufacturer filters and incremental display.
- `scripts/validate-site.mjs` rejects products with missing HTTPS photo URLs.

## Limitations
A manufacturer may restrict automated access, omit images for a particular SKU, or require authorized reseller catalog exports. If so, the discovery job skips those records. Do not invent SKUs or pictures, assume a missing stock status means no stock, or claim that all manufacturer products are imported when they are not.

The combined import job's actual output counts and source access logs must be reviewed in GitHub Actions. HENDI publicly says it offers more than 4,000 products; importing all of these cannot be established from the current 17-product preview alone.

The original `gastrosky.hu` production website is not changed by this workflow.
