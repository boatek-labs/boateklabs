// lib/siteUrl.js
// Builds the real public URL of this deployment, detected from the incoming
// request itself rather than guessed from platform-specific environment
// variables. This is the most reliable way to get this right: whatever host
// and protocol a visitor actually used to reach the server is exactly what
// should appear in links sent back out (e.g. in email notifications) —
// whether that's http://localhost:3000 in development, a Render/Railway/Fly
// subdomain, or a custom production domain.
//
// Requires `app.set('trust proxy', true)` in server.js so that req.protocol
// correctly reflects X-Forwarded-Proto when running behind a reverse proxy
// (Render, Railway, Fly, Nginx, etc. all set this header).
//
// SITE_URL in .env can still be set to force a specific value (useful for
// background jobs with no request context, or if you want emails to always
// point at a canonical domain regardless of which host header arrived).

function getBaseUrl(req) {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, '');
  }
  if (req) {
    const protocol = req.protocol || (req.headers && req.headers['x-forwarded-proto']) || 'http';
    const host = req.get ? req.get('host') : req.headers && req.headers.host;
    if (host) return `${protocol}://${host}`;
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}

function buildUrl(req, path) {
  const base = getBaseUrl(req);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

module.exports = { getBaseUrl, buildUrl };
