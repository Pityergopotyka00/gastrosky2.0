# GastroSky 2.0 security and anti-scraping

## Protections implemented in code
- All static assets pass through the Cloudflare Worker (`assets.run_worker_first`).
- Browser security headers: nosniff, anti-framing, referrer policy, restrictive permissions; HTML receives a **report-only** Content Security Policy.
- Deny access to common sensitive paths and source maps.
- Write requests other than quote POST are rejected.
- Cloudflare-native local rate-limit bindings on `GET /api/products`, `GET /data/catalog-products.json`, and `POST /api/quote`: currently catalog 90/minute and quote 12/minute per Cloudflare location and visitor IP. The counters are approximate and shared networks can be affected. Allowance should be reviewed against actual traffic.
- Product API pages limited to 30 entries per request.
- The configured quote API requires same-origin requests and successful Cloudflare Turnstile verification.

## Critical limitation — cloning cannot be prevented by frontend code
The site *still serves the complete catalog* as `/data/catalog-products.json`; the frontend also fetches the public GitHub raw catalog as a backup. The repository currently hosts public source. **Both the HTML source and public catalog can be copied**. Rate limits do not hide already public assets, and browsers must receive HTML/CSS/images to render them. These are not secret or DRM measures. Do not add right-click blocking or keyboard restrictions: they offer no real protection and impair usability.

## Deployment and Cloudflare account checklist (manual)
1. Deploy the current Worker version, then confirm the home page and all 11 brand filters work. Verify that catalog and quote requests return expected results and `429` when deliberately exceeding limits.
2. Enable Cloudflare WAF managed rules and Bot Fight Mode / bot protections supported by the account plan. Use managed challenges for clearly automated abuse; avoid challenging ordinary shoppers.
3. Add Cloudflare account-level WAF rate limiting for repeated requests to `/data/catalog-products.json` and `/api/products`. WAF rules can act before Worker execution and help against bursts, unlike the Worker-only checks. Review challenge rates and false positives.
4. Add Cloudflare account alerts for unusual traffic, error rates, and quote submission spikes.
5. Keep Cloudflare account credentials and Resend/Turnstile keys exclusively in Cloudflare Secrets, enable 2FA, and grant least privilege to contributors.
6. If you want non-public source code, change GitHub repository visibility in GitHub settings *after checking deployment permissions and collaborators*. The previously published data remains obtainable from anyone who copied it.
7. For meaningfully stronger catalog protection, replace the full-public-catalog asset and public raw GitHub fallback with a Worker-backed paginated/searchable feed, then keep non-public supplier data only in server-side storage. Public product cards will remain copyable.

## Before claiming production protection
Check deployment status and test real requests. Tests in this repository check code behavior but do not prove live WAF configuration, email delivery, or crawler resistance. Cloudflare rate limits are eventually consistent and per location.
