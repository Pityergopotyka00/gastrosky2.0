# GastroSky 2.0

Independent, **not yet deployed**, prototype for the new GastroSky product catalog. Production site `gastrosky.hu` remains untouched.

## Current
- 9 Maxima products, including 4 industrial dishwashers
- Original GastroSky logo loaded from `https://gastrosky.hu/assets/images/logo.png`
- Two specific Maxima manufacturer photo URLs; other products clearly show that their photos are pending
- Search by name, SKU, EAN, and category
- Links to legal drafts (`impresszum.html`, `adatkezeles.html`, `sutik.html`)
- Worker with D1 stock-check schema and 5-minute cron configuration, but **disabled and not deployed**.
- Stock is `unknown` until a real supplier check works; screenshots are not a source of live data.

## Test locally

No Node needed: open `index.html` directly. Product listings are embedded into the HTML for standalone preview.
To build for Cloudflare (Node.js 20+):

```bash
npm install
npm run build
```

## Stock monitoring (experimental)

See [docs/STOCK_SYNC.md](docs/STOCK_SYNC.md). `ENABLE_STOCK_SYNC` stays false until Maxima approves automated access and the scraper or an official supplier feed is verified. The D1 database ID is a placeholder and must be configured before deployment. A stock status must never be labeled live unless its source and actual check timestamp are confirmed.

## Product pictures

Maxima source photos are third-party media. Supplier reseller display rights must be confirmed. The URL on the image is not a customer navigation link. Use `npm run media:maxima` to request official per-product `og:image` URLs and update the catalog source, then re-embed and review before shipping. If the URLs block hotlinking or license terms disallow reuse, request the supplier's dealer media feed.

## Legal pages
Legal information is a **draft**. Existing publicly listed company information has been carried into the imprint as check-required; details, hosting, retention and privacy flows need owner/legal review before launch.

## Next
- Licensed Maxima product images for every SKU
- Authorized supplier feed and validated stock extraction
- Quote-request list + form + actual email delivery
- Cloudflare test deployment, QA, owner approval
