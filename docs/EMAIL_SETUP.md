# GastroSky email system setup

The website already has a Hungarian quote-request form and the Cloudflare Worker endpoint `POST /api/quote`.
The Worker sends a quote notification to the business via Resend. After the provider accepts that message, it also attempts a Hungarian confirmation email to the customer.

**No email delivery will work until the sender domain is verified and the secrets below are configured.** The checkout is not a payment/order processor; this is only a quote-request flow.

## 1. Verify your domain with Resend

1. Create/sign in to the business-owned Resend account.
2. Add `gastrosky.eu` under Domains and copy the exact DNS records Resend shows.
3. At the DNS provider for `gastrosky.eu`, add the provided SPF/DKIM records (and the requested MX records if applicable). Keep any existing mailbox MX records intact unless your mail provider explicitly tells you to replace them.
4. Wait for Resend's domain verification to show verified.
5. Decide which inbox should receive quotes. It must already be able to receive mail, e.g. an existing business inbox. **Resend sending does not create a mailbox.**

Suggested sender: `GastroSky <ajanlat@gastrosky.eu>`.
Example recipient: `info@gastrosky.hu`, only if the business still uses that inbox.

## 2. Configure the Cloudflare Worker

In Cloudflare → Workers & Pages → `gastrosky2-0` → Settings → Variables and Secrets, add:

| Variable | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Resend API key with send permission |
| `QUOTE_FROM_EMAIL` | Text | `GastroSky <ajanlat@gastrosky.eu>` (after verifying domain) |
| `QUOTE_TO_EMAIL` | Text | The business's real receiving email |
| `TURNSTILE_SECRET_KEY` | Secret | Turnstile secret key |
| `TURNSTILE_SITE_KEY` | Text | Turnstile site key for the deployed domain |
| `QUOTE_CUSTOMER_CONFIRMATION` | Text (optional) | `true` (default); `false` disables customer receipts |

For GitHub/CLI deployments, configure the public text values for the **same deployed Worker environment**, and store the sensitive values as Worker secrets (not GitHub source files). To set secrets using Wrangler:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Never paste API keys, Turnstile secret keys, or passwords into a public repository or chat.

## 3. Create Cloudflare Turnstile

Set up a Turnstile widget allowing the actual deployed hostname, e.g. `gastrosky.eu` and `www.gastrosky.eu` if used.
Copy its site and secret keys to the corresponding Worker settings. The existing storefront asks `GET /api/quote-config` for the public site key.

## 4. Verify end-to-end

1. Open `https://gastrosky.eu/api/quote-config`. It should return `{"enabled":true,...}` once configured.
2. Select a product and send a genuine test quote from the website.
3. Confirm the business receives the request listing SKU, product name, sender email, and message.
4. Confirm the customer receives the Hungarian receipt. Some providers may restrict sends until the account/domain is approved.
5. If the business email works but the customer receipt doesn't, examine Cloudflare Worker logs and the Resend email activity. The API response includes `customerConfirmationSent` to indicate whether Resend accepted the receipt request, **not** inbox delivery.
6. Check SPF/DKIM and consider a DMARC policy appropriate for the domain to improve deliverability.

## Security and privacy

The Worker validates inputs, checks same-origin requests, verifies Turnstile server-side, and maps requested product IDs to the trusted catalog. The customer email address is only used for the quote and the requested confirmation. Do not add marketing emails without an independent opt-in and appropriate privacy notice. Rate limiting at Cloudflare and a business privacy policy should be reviewed before launch.
