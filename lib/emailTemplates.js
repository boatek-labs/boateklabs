// lib/emailTemplates.js
// Branded HTML wrapper for every email this app sends. Keeps a single visual
// identity (dark navy header, cyan accent, Boatek Labs mark) across contact
// notifications, career applications, collaboration requests, general
// inquiries, and Signal Capsule messages — rather than sending plain text.

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fieldRow(label, value) {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #1E2A3F; vertical-align:top; width:130px;">
        <span style="font-family:'Courier New',monospace; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#8B94A7;">${escapeHtml(label)}</span>
      </td>
      <td style="padding:10px 0; border-bottom:1px solid #1E2A3F; color:#F5F7FA; font-size:14px;">
        ${escapeHtml(value).replace(/\n/g, '<br>')}
      </td>
    </tr>`;
}

/**
 * Wraps a title, intro line, a set of {label, value} fields, and a call-to-action
 * link into a single branded HTML email.
 *
 * @param {Object} opts
 * @param {string} opts.eyebrow - small label above the title (e.g. "NEW PROJECT INQUIRY")
 * @param {string} opts.title - main heading
 * @param {string} opts.intro - one-line description
 * @param {Array<{label:string, value:string}>} opts.fields - rows to render
 * @param {string} [opts.ctaLabel] - button text, e.g. "View in Admin Dashboard"
 * @param {string} [opts.ctaUrl] - button link (built with the request's real host)
 * @param {string} [opts.longField] - label for a longer message/brief field rendered below the table
 * @param {string} [opts.longFieldValue] - the long text itself
 */
function renderEmail({ eyebrow, title, intro, fields = [], ctaLabel, ctaUrl, longFieldLabel, longFieldValue, bodyHtml = '' }) {
  const rows = fields.map(f => fieldRow(f.label, f.value)).join('');

  const longBlock = longFieldValue ? `
    <div style="margin-top:24px;">
      <div style="font-family:'Courier New',monospace; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#8B94A7; margin-bottom:8px;">${escapeHtml(longFieldLabel || 'Message')}</div>
      <div style="background:#0E1524; border:1px solid #1E2A3F; border-radius:6px; padding:16px 18px; color:#F5F7FA; font-size:14px; line-height:1.6; white-space:pre-wrap;">${escapeHtml(longFieldValue)}</div>
    </div>` : '';

  const ctaBlock = (ctaLabel && ctaUrl) ? `
    <div style="margin-top:30px;">
      <a href="${ctaUrl}" style="display:inline-block; background:#3B82F6; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; padding:12px 24px; border-radius:4px;">${escapeHtml(ctaLabel)} &rarr;</a>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#070B14; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070B14; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#0E1524; border:1px solid #1E2A3F; border-radius:10px; overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#101c3a,#1c1440); padding:28px 32px;">
              <div style="font-family:Georgia,serif; font-size:18px; font-weight:700; color:#ffffff; letter-spacing:0.02em;">
                <span style="color:#22D3EE;">&lt;</span>BOATEK LABS<span style="color:#22D3EE;">&gt;</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="font-family:'Courier New',monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#22D3EE; margin-bottom:10px;">${escapeHtml(eyebrow)}</div>
              <h1 style="margin:0 0 12px; font-size:22px; color:#F5F7FA;">${escapeHtml(title)}</h1>
              <p style="margin:0 0 24px; font-size:14px; color:#8B94A7; line-height:1.6;">${escapeHtml(intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rows}
              </table>
              ${longBlock}
              ${bodyHtml}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px; border-top:1px solid #1E2A3F; font-family:'Courier New',monospace; font-size:11px; color:#5B6478;">
              Boatek Labs &mdash; Creative Technology Studio
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmail };
