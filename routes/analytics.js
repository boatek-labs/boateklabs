// routes/analytics.js
// Privacy-respecting pageview tracking: no cookies, no persistent
// cross-session identifier, no third-party service. Each pageview is stored
// as { path, timestamp, visitorHash, referrerDomain }.
//
// visitorHash is a one-way hash of (IP + today's date + a server-side salt),
// so it changes every day and cannot be reversed back to an IP address or
// linked across days — good enough to count "roughly how many distinct
// visitors" without tracking anyone individually over time. This is a
// deliberately minimal, self-hosted equivalent of privacy-first tools like
// Plausible/Umami, built into this same app rather than requiring separate
// hosted infrastructure — see README for that tradeoff.

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const JsonStore = require('../lib/jsonStore');

const router = express.Router();
const store = new JsonStore(path.join(__dirname, '..', 'data', 'pageviews.json'));

const DAILY_SALT = crypto.randomBytes(16).toString('hex'); // rotates on server restart too

function hashVisitor(ip) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${ip}:${day}:${DAILY_SALT}`).digest('hex').slice(0, 16);
}

function extractDomain(referrer) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}

router.post('/pageview', async (req, res) => {
  const { path: pagePath, referrer } = req.body || {};
  if (!pagePath || typeof pagePath !== 'string') {
    return res.status(400).json({ error: 'path is required.' });
  }

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  try {
    await store.append({
      path: pagePath.slice(0, 200),
      timestamp: new Date().toISOString(),
      visitorHash: hashVisitor(ip),
      referrerDomain: extractDomain(referrer)
    });
  } catch (err) {
    console.error('[analytics] failed to record pageview:', err);
    // Never let analytics failures surface as an error to the visitor.
  }

  res.status(204).end();
});

module.exports = router;
