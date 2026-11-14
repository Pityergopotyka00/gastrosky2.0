// Public storefront hardening. These controls improve browser and API safety;
// they do not make publicly delivered pages or product data impossible to copy.
const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
  'x-robots-tag': 'noarchive',
};

// A report-only policy avoids unexpectedly breaking quote verification or
// manufacturer images while the live storefront is being audited.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://formsubmit.co",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://raw.githubusercontent.com https://formsubmit.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "upgrade-insecure-requests"
].join('; ');

export function securityResponse(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  // Only HTML needs CSP in this phase. Do not alter image or JS response bodies.
  if ((headers.get('content-type') || '').includes('text/html'))
    headers.set('content-security-policy-report-only', csp);
  const body = [204, 205, 304].includes(response.status) ? null : response.body;
  return new Response(body, {status: response.status, statusText: response.statusText, headers});
}

export function rejectUnsafeRequest(request) {
  const url = new URL(request.url);
  // Never expose repository metadata, credentials, or source maps via the website.
  if (/(^|\/)\.(?:git|github|env|wrangler|npmrc)(?:\/|$)/i.test(url.pathname) ||
      /(?:^|\/)(?:node_modules|package-lock\.json|wrangler\.toml|wrangler\.jsonc)(?:\/|$)/i.test(url.pathname) ||
      /\.map$/i.test(url.pathname)) {
    return new Response('Not found', {status: 404});
  }
  // No public write operations except the quote endpoint, which validates
  // same-origin requests and Cloudflare Turnstile tokens separately.
  if (!['GET', 'HEAD'].includes(request.method) &&
      !(url.pathname === '/api/quote' && request.method === 'POST')) {
    return new Response('Method not allowed', {status: 405, headers: {allow: 'GET, HEAD'}});
  }
  return null;
}
