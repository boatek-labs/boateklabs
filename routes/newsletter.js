// routes/newsletter.js
const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');
const crypto = require('crypto');
const { sendMail } = require('../lib/mailer');
const { buildUrl } = require('../lib/siteUrl');

const router = express.Router();
const store = new JsonStore(path.join(__dirname, '..', 'data', 'subscribers.json'));
const pendingStore = new JsonStore(path.join(__dirname, '..', 'data', 'newsletter-verifications.json'));
const OTP_TTL_MS = 15 * 60 * 1000;
function hashOtp(email, otp) {
  return crypto.createHmac('sha256', process.env.OTP_SECRET || process.env.ADMIN_PASSWORD || 'boatek-newsletter-otp-change-this')
    .update(`${email}:${otp}`).digest('hex');
}
async function readPending() { return pendingStore.readAll(); }
async function writePending(list) { return pendingStore.replace(list); }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}


router.post('/', async (req, res) => {
  const { email, website } = req.body || {};
  if (website) return res.status(201).json({ ok: true });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please provide a valid email address.' });
  const normalized = String(email).trim().toLowerCase();

  try {
    const existing = await store.readAll();
    if (existing.some((s) => s.email === normalized)) return res.status(200).json({ ok: true, alreadySubscribed: true });
    if (process.env.NODE_ENV === 'production' && !process.env.OTP_SECRET) return res.status(503).json({ error: 'Email verification is not configured yet.' });

    const otp = String(crypto.randomInt(100000, 1000000));
    const pending = await readPending();
    const next = pending.filter((entry) => entry.email !== normalized);
    next.push({ id: makeId(), email: normalized, otpHash: hashOtp(normalized, otp), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, createdAt: new Date().toISOString() });
    await writePending(next);

    const emailHtml = `<!doctype html><html><body style="margin:0;background:#08101d;color:#f4f7fb;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;background:#111b2b;border:1px solid #27364d;border-radius:12px;padding:32px"><h2 style="color:#25c9e6">Boatek Labs</h2><h1>Confirm your email</h1><p>Use this code to confirm your newsletter subscription. It expires in 15 minutes.</p><div style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#0a1220;padding:20px;text-align:center;border-radius:8px">${otp}</div><p style="color:#9ba9bb;font-size:12px">If you didn't request this, you can ignore this email.</p></div></body></html>`;
    const sent = await sendMail({ to: normalized, subject: 'Confirm your Boatek Labs newsletter subscription', text: `Your Boatek Labs verification code is ${otp}. It expires in 15 minutes.`, html: emailHtml });
    if (!sent.sent && process.env.NODE_ENV === 'production') return res.status(503).json({ error: 'Email delivery is not configured. Please try again later.' });
    res.status(200).json({ ok: true, verificationRequired: true, message: 'Check your inbox for a verification code.' });
  } catch (err) {
    console.error('[newsletter] verification start failed:', err);
    res.status(500).json({ error: 'Could not start email verification. Please try again.' });
  }
});

router.post('/verify', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter your email and the 6-digit code.' });
  try {
    const pending = await readPending();
    const entry = pending.find((p) => p.email === email);
    if (!entry) return res.status(400).json({ error: 'No pending verification found. Request a new code.' });
    if (Date.now() > entry.expiresAt) {
      await writePending(pending.filter((p) => p.email !== email));
      return res.status(400).json({ error: 'That code expired. Please request a new one.' });
    }
    if (entry.attempts >= 5) {
      await writePending(pending.filter((p) => p.email !== email));
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }
    const submitted = hashOtp(email, otp);
    const expected = Buffer.from(entry.otpHash, 'hex');
    const actual = Buffer.from(submitted, 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      entry.attempts += 1;
      await writePending(pending);
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }
    const subscribers = await store.readAll();
    if (!subscribers.some((s) => s.email === email)) await store.append({ id: makeId(), email, subscribedAt: new Date().toISOString(), verified: true });
    await writePending(pending.filter((p) => p.email !== email));
    const welcomeHtml = `<!doctype html><html><body style="margin:0;background:#08101d;color:#f4f7fb;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;background:#111b2b;border:1px solid #27364d;border-radius:12px;padding:32px"><h2 style="color:#25c9e6">Boatek Labs</h2><h1>You're on the list.</h1><p>Welcome to Boatek Labs. We build software, games, experiments, and digital experiences with curiosity and intent. Our journal shares the thinking behind projects, useful discoveries, design notes, and occasional studio updates.</p><p>Thanks for joining. We'll keep updates purposeful and you can unsubscribe whenever you want.</p><a href="${buildUrl(req, '/')}" style="color:#25c9e6">Explore the studio</a></div></body></html>`;
    try { await sendMail({ to: email, subject: 'Welcome to Boatek Labs', text: 'Welcome to Boatek Labs. You are now subscribed to studio updates.', html: welcomeHtml }); } catch (mailError) { console.error('[newsletter] welcome email failed:', mailError.message); }
    res.json({ ok: true, verified: true });
  } catch (err) {
    console.error('[newsletter] verification failed:', err);
    res.status(500).json({ error: 'Could not verify your email right now.' });
  }
});

module.exports = router;
