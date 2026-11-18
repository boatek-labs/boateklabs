// routes/payments.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const PAYSTACK_API = 'https://api.paystack.co';

router.post('/paystack/initialize', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const amount = Number(req.body?.amount);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!Number.isFinite(amount) || amount < 1 || amount > 5000) return res.status(400).json({ error: 'Donation must be between GHS 1 and GHS 5,000.' });
  if (!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Donations are not configured yet. Please try again later.' });

  const reference = `boatek-donation-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: 'GHS',
        reference,
        callback_url: `${(process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/api/payments/paystack/callback`
      })
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data?.authorization_url) {
      console.error('[payments] Paystack initialization error:', result.message || 'Unknown error');
      return res.status(502).json({ error: 'Could not start payment. Please try again.' });
    }
    res.json({ ok: true, authorizationUrl: result.data.authorization_url });
  } catch (error) {
    console.error('[payments] initialization failed:', error.message);
    res.status(502).json({ error: 'Payment service is temporarily unavailable.' });
  }
});

router.get('/paystack/callback', async (req, res) => {
  const reference = String(req.query.reference || req.query.trxref || '');
  if (!reference || !process.env.PAYSTACK_SECRET_KEY) return res.status(400).send('Payment reference missing.');
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const result = await response.json();
    const valid = response.ok && result.status && result.data?.status === 'success' && result.data?.reference === reference;
    res.status(valid ? 200 : 400).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Boatek Labs Donation</title></head><body style="font-family:system-ui;background:#0b1020;color:#f4f6fa;display:grid;min-height:100vh;place-items:center"><main style="max-width:480px;padding:32px;text-align:center"><h1>${valid ? 'Thank you for supporting Boatek Labs!' : 'Payment could not be verified'}</h1><p>${valid ? 'Your contribution was confirmed. We appreciate you helping independent creative technology grow.' : 'Please check your payment status or contact us if you believe this is an error.'}</p><a style="color:#55d7ed" href="/">Return to Boatek Labs</a></main></body></html>`);
  } catch (error) {
    console.error('[payments] verify error:', error.message);
    res.status(502).send('Could not verify your payment at this time.');
  }
});

module.exports = router;
