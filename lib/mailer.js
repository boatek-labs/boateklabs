// lib/mailer.js
// Sends notification emails when SMTP env vars are configured.
//
// If they are NOT configured:
//   - In development (NODE_ENV !== 'production'), this automatically creates a
//     free Ethereal test-SMTP account on first use and actually sends the email
//     through it, logging a preview URL you can open in a browser to see the
//     real rendered email. This is a genuine send, not a fake — just to a
//     throwaway test inbox instead of your production one.
//   - In production, it logs to console instead of failing the request, since
//     a missing SMTP config shouldn't take down the contact form.

const nodemailer = require('nodemailer');

let etherealTransportPromise = null;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getRealTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function getEtherealTransport() {
  if (!etherealTransportPromise) {
    etherealTransportPromise = nodemailer.createTestAccount().then((testAccount) => {
      console.log('[mailer] Created a temporary Ethereal test-email account for dev use.');
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
    });
  }
  return etherealTransportPromise;
}

async function sendMail({ subject, text, html, to, bcc, replyTo }) {
  const recipient = to || process.env.CONTACT_TO_EMAIL || 'hello@boateklabs.com';

  if (isConfigured()) {
    const transport = getRealTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject,
      text,
      html,
      ...(bcc && bcc.length ? { bcc } : {}),
      ...(replyTo ? { replyTo } : {})
    });
    return { sent: true, mode: 'production-smtp' };
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      const transport = await getEtherealTransport();
      const info = await transport.sendMail({
        from: 'Boatek Labs Dev <dev@boateklabs.local>',
        to: recipient,
        subject,
        text,
        html,
        ...(bcc && bcc.length ? { bcc } : {}),
        ...(replyTo ? { replyTo } : {})
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('[mailer] Dev email actually sent via Ethereal. Preview it here:');
      console.log(`[mailer] ${previewUrl}`);
      return { sent: true, mode: 'ethereal-dev', previewUrl };
    } catch (err) {
      console.error('[mailer] Ethereal dev send failed, falling back to console log:', err.message);
    }
  }

  console.log('[mailer] SMTP not configured — logging instead of sending:');
  console.log(`[mailer] To: ${recipient}`);
  console.log(`[mailer] Subject: ${subject}`);
  console.log(`[mailer] Body: ${text}`);
  return { sent: false, reason: 'smtp-not-configured' };
}

module.exports = { sendMail, isConfigured };

