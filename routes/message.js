// routes/message.js
const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');
const { sendMail } = require('../lib/mailer');
const { renderEmail } = require('../lib/emailTemplates');
const { buildUrl } = require('../lib/siteUrl');

const router = express.Router();
const store = new JsonStore(path.join(__dirname, '..', 'data', 'messages.json'));

router.post('/', async (req, res) => {
  const { message } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    message: String(message).slice(0, 2000),
    receivedAt: new Date().toISOString()
  };

  try {
    await store.append(record);
  } catch (err) {
    console.error('[message] failed to persist message:', err);
    return res.status(500).json({ error: 'Could not deliver your message right now.' });
  }

  sendMail({
    subject: 'New Signal Capsule message',
    text: record.message,
    html: renderEmail({
      eyebrow: 'Signal Capsule',
      title: 'New chat message',
      intro: 'Someone sent a message through the Signal Capsule chat drawer.',
      fields: [],
      longFieldLabel: 'Message',
      longFieldValue: record.message,
      ctaLabel: 'View in Admin Dashboard',
      ctaUrl: buildUrl(req, '/admin')
    })
  }).catch((err) => console.error('[message] email notification failed:', err));

  return res.status(201).json({
    ok: true,
    reply: "Got it — that's logged. We usually reply by email within a day."
  });
});

module.exports = router;
