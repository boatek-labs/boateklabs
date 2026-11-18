// server.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const inquiriesRoute = require('./routes/inquiries');
const newsletterRoute = require('./routes/newsletter');
const messageRoute = require('./routes/message');
const configRoute = require('./routes/config');
const teamRoute = require('./routes/team');
const adminRoute = require('./routes/admin');
const projectsRoute = require('./routes/projects');
const journalRoute = require('./routes/journal');
const analyticsRoute = require('./routes/analytics');
const portalRoute = require('./routes/portal');
const githubRoute = require('./routes/github');
const rssRoute = require('./routes/rss');
const sitemapRoute = require('./routes/sitemap');
const paymentsRoute = require('./routes/payments');


// Safety net: an uncaught error inside a route handler (a bug like a typo'd
// method name) should show up loudly in the logs and, ideally, in the
// response as a 500 — not silently kill the entire Node process and take
// every visitor offline. Express's own error-handling middleware below
// already catches errors passed via next(err); these two handlers catch the
// rarer case of something throwing outside that flow (e.g. inside a
// fire-and-forget async callback).
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception (server stays up):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection (server stays up):', reason);
});

const app = express();

app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later.' }
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/contact', apiLimiter, inquiriesRoute);
app.use('/api/newsletter', apiLimiter, newsletterRoute);
app.use('/api/message', apiLimiter, messageRoute);
app.use('/api/config', configRoute);
app.use('/api/team', teamRoute);
app.use('/api/projects', projectsRoute);
app.use('/api/journal', journalRoute);
app.use('/api/portal', apiLimiter, portalRoute);
app.use('/api/github-stats', githubRoute);
app.use('/rss.xml', rssRoute);
app.use('/sitemap.xml', sitemapRoute);
app.use('/api/analytics', analyticsLimiter, analyticsRoute);
app.use('/api/payments', apiLimiter, paymentsRoute);
app.use('/api/admin', adminRoute);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'boatek-labs-site', time: new Date().toISOString() });
});

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

app.listen(PORT, () => {
  console.log(`Boatek Labs server running on http://localhost:${PORT}`);
});
