// routes/inquiries.js
// Four distinct contact pathways, each with its own fields and its own storage file,
// because a client wanting a project built, a candidate wanting to be hired, an
// organization wanting to collaborate, and a general question are genuinely
// different intents that deserve different forms — not one form with a dropdown.

const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');
const { sendMail } = require('../lib/mailer');
const { renderEmail } = require('../lib/emailTemplates');
const { buildUrl } = require('../lib/siteUrl');
const { getRequestUser } = require('../lib/userAuth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const projectStore = new JsonStore(path.join(__dirname, '..', 'data', 'project-inquiries.json'));
const careersStore = new JsonStore(path.join(__dirname, '..', 'data', 'career-applications.json'));
const collabStore = new JsonStore(path.join(__dirname, '..', 'data', 'collaboration-requests.json'));
const generalStore = new JsonStore(path.join(__dirname, '..', 'data', 'general-inquiries.json'));

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isHoneypotTriggered(body) {
  return !!(body && body.website);
}

// ---------- POST /api/contact/project ----------
router.post('/project', async (req, res) => {
  const { projectType, name, email, brief, budget, timeline } = req.body || {};

  if (isHoneypotTriggered(req.body)) {
    console.log('[project-inquiry] honeypot triggered — silently discarding.');
    return res.status(201).json({ ok: true, id: 'discarded' });
  }
  if (!name || !email || !brief) {
    return res.status(400).json({ error: 'Name, email, and a project brief are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const accountUser = await getRequestUser(req).catch(() => null);
  const record = {
    id: makeId(),
    userId: accountUser?.id || null,
    projectType: (projectType || 'Not specified').slice(0, 100),
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    brief: String(brief).slice(0, 5000),
    budget: (budget || '').slice(0, 200),
    timeline: (timeline || '').slice(0, 200),
    receivedAt: new Date().toISOString()
  };

  try {
    await projectStore.append(record);
  } catch (err) {
    console.error('[project-inquiry] failed to persist:', err);
    return res.status(500).json({ error: 'Could not save your submission right now.' });
  }

  sendMail({
    subject: `New project inquiry from ${record.name} (${record.projectType})`,
    text: [
      `Name: ${record.name}`, `Email: ${record.email}`, `Project type: ${record.projectType}`,
      `Budget: ${record.budget || 'Not provided'}`, `Timeline: ${record.timeline || 'Not provided'}`,
      '', 'Brief:', record.brief
    ].join('\n'),
    html: renderEmail({
      eyebrow: 'New Project Inquiry',
      title: `${record.name} wants to build something`,
      intro: 'A new submission came in through the "Start a Project" form.',
      fields: [
        { label: 'Name', value: record.name },
        { label: 'Email', value: record.email },
        { label: 'Type', value: record.projectType },
        { label: 'Budget', value: record.budget || 'Not provided' },
        { label: 'Timeline', value: record.timeline || 'Not provided' }
      ],
      longFieldLabel: 'Project Brief',
      longFieldValue: record.brief,
      ctaLabel: 'View in Admin Dashboard',
      ctaUrl: buildUrl(req, '/admin')
    })
  }).catch((err) => console.error('[project-inquiry] email failed:', err));

  // Confirmation email back to the person who submitted, so both sides of this
  // exchange are designed, not just the internal notification.
  sendMail({
    to: record.email,
    subject: "We've got your project brief — Boatek Labs",
    text: `Hi ${record.name},\n\nThanks for reaching out about your ${record.projectType.toLowerCase()} project. We usually reply within a day.\n\n— Boatek Labs`,
    html: renderEmail({
      eyebrow: 'Thanks for reaching out',
      title: `We've got your brief, ${record.name.split(' ')[0]}`,
      intro: `Thanks for telling us about your ${record.projectType.toLowerCase()} project. We read every brief personally and usually reply within a day.`,
      fields: [
        { label: 'Type', value: record.projectType },
        { label: 'Submitted', value: new Date(record.receivedAt).toLocaleString() }
      ],
      ctaLabel: 'Explore Our Work',
      ctaUrl: buildUrl(req, '/work.html')
    })
  }).catch((err) => console.error('[project-inquiry] confirmation email failed:', err));

  return res.status(201).json({ ok: true, id: record.id });
});

// ---------- POST /api/contact/careers ----------
router.post('/careers', async (req, res) => {
  const { name, email, roleInterest, portfolioUrl, message } = req.body || {};

  if (isHoneypotTriggered(req.body)) {
    console.log('[career-application] honeypot triggered — silently discarding.');
    return res.status(201).json({ ok: true, id: 'discarded' });
  }
  if (!name || !email || !roleInterest || !message) {
    return res.status(400).json({ error: 'Name, email, role, and a short message are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const record = {
    id: makeId(),
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    roleInterest: String(roleInterest).slice(0, 150),
    portfolioUrl: (portfolioUrl || '').slice(0, 500),
    message: String(message).slice(0, 5000),
    receivedAt: new Date().toISOString()
  };

  try {
    await careersStore.append(record);
  } catch (err) {
    console.error('[career-application] failed to persist:', err);
    return res.status(500).json({ error: 'Could not save your application right now.' });
  }

  sendMail({
    subject: `New application: ${record.roleInterest} — ${record.name}`,
    text: [
      `Name: ${record.name}`, `Email: ${record.email}`, `Role: ${record.roleInterest}`,
      `Portfolio: ${record.portfolioUrl || 'Not provided'}`, '', 'Message:', record.message
    ].join('\n'),
    html: renderEmail({
      eyebrow: 'New Career Application',
      title: `${record.name} applied for ${record.roleInterest}`,
      intro: 'A new submission came in through the "Join the Team" form.',
      fields: [
        { label: 'Name', value: record.name },
        { label: 'Email', value: record.email },
        { label: 'Role', value: record.roleInterest },
        { label: 'Portfolio', value: record.portfolioUrl || 'Not provided' }
      ],
      longFieldLabel: 'Message',
      longFieldValue: record.message,
      ctaLabel: 'View in Admin Dashboard',
      ctaUrl: buildUrl(req, '/admin')
    })
  }).catch((err) => console.error('[career-application] email failed:', err));

  sendMail({
    to: record.email,
    subject: 'Your application to Boatek Labs',
    text: `Hi ${record.name},\n\nThanks for applying for ${record.roleInterest}. We review every application personally and will follow up if there's a fit.\n\n— Boatek Labs`,
    html: renderEmail({
      eyebrow: 'Application received',
      title: `Thanks for applying, ${record.name.split(' ')[0]}`,
      intro: `We've got your application for ${record.roleInterest}. We review every application personally and will follow up if there's a fit.`,
      fields: [
        { label: 'Role', value: record.roleInterest },
        { label: 'Submitted', value: new Date(record.receivedAt).toLocaleString() }
      ],
      ctaLabel: 'Meet the Team',
      ctaUrl: buildUrl(req, '/team.html')
    })
  }).catch((err) => console.error('[career-application] confirmation email failed:', err));

  return res.status(201).json({ ok: true, id: record.id });
});

// ---------- POST /api/contact/collaborate ----------
router.post('/collaborate', async (req, res) => {
  const { organization, contactName, email, partnershipType, message } = req.body || {};

  if (isHoneypotTriggered(req.body)) {
    console.log('[collaboration-request] honeypot triggered — silently discarding.');
    return res.status(201).json({ ok: true, id: 'discarded' });
  }
  if (!contactName || !email || !partnershipType || !message) {
    return res.status(400).json({ error: 'Contact name, email, partnership type, and a message are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const accountUser = await getRequestUser(req).catch(() => null);
  const record = {
    id: makeId(),
    userId: accountUser?.id || null,
    organization: (organization || 'Not provided').slice(0, 200),
    contactName: String(contactName).slice(0, 200),
    email: String(email).slice(0, 200),
    partnershipType: String(partnershipType).slice(0, 150),
    message: String(message).slice(0, 5000),
    receivedAt: new Date().toISOString()
  };

  try {
    await collabStore.append(record);
  } catch (err) {
    console.error('[collaboration-request] failed to persist:', err);
    return res.status(500).json({ error: 'Could not save your request right now.' });
  }

  sendMail({
    subject: `New collaboration request from ${record.organization} (${record.partnershipType})`,
    text: [
      `Organization: ${record.organization}`, `Contact: ${record.contactName}`, `Email: ${record.email}`,
      `Partnership type: ${record.partnershipType}`, '', 'Message:', record.message
    ].join('\n'),
    html: renderEmail({
      eyebrow: 'New Collaboration Request',
      title: `${record.organization} wants to partner`,
      intro: 'A new submission came in through the "Partner With Us" form.',
      fields: [
        { label: 'Organization', value: record.organization },
        { label: 'Contact', value: record.contactName },
        { label: 'Email', value: record.email },
        { label: 'Type', value: record.partnershipType }
      ],
      longFieldLabel: 'Message',
      longFieldValue: record.message,
      ctaLabel: 'View in Admin Dashboard',
      ctaUrl: buildUrl(req, '/admin')
    })
  }).catch((err) => console.error('[collaboration-request] email failed:', err));

  sendMail({
    to: record.email,
    subject: 'Your partnership proposal — Boatek Labs',
    text: `Hi ${record.contactName},\n\nThanks for proposing a partnership on behalf of ${record.organization}. We review every proposal and will follow up shortly.\n\n— Boatek Labs`,
    html: renderEmail({
      eyebrow: 'Proposal received',
      title: `Thanks, ${record.contactName.split(' ')[0]}`,
      intro: `We've received the partnership proposal from ${record.organization}. We review every proposal personally and will follow up shortly.`,
      fields: [
        { label: 'Type', value: record.partnershipType },
        { label: 'Submitted', value: new Date(record.receivedAt).toLocaleString() }
      ],
      ctaLabel: 'About Boatek Labs',
      ctaUrl: buildUrl(req, '/team.html')
    })
  }).catch((err) => console.error('[collaboration-request] confirmation email failed:', err));

  return res.status(201).json({ ok: true, id: record.id });
});

// ---------- POST /api/contact/general ----------
router.post('/general', async (req, res) => {
  const { name, email, message } = req.body || {};

  if (isHoneypotTriggered(req.body)) {
    console.log('[general-inquiry] honeypot triggered — silently discarding.');
    return res.status(201).json({ ok: true, id: 'discarded' });
  }
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and a message are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const record = {
    id: makeId(),
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    message: String(message).slice(0, 3000),
    receivedAt: new Date().toISOString()
  };

  try {
    await generalStore.append(record);
  } catch (err) {
    console.error('[general-inquiry] failed to persist:', err);
    return res.status(500).json({ error: 'Could not save your message right now.' });
  }

  sendMail({
    subject: `New general inquiry from ${record.name}`,
    text: [`Name: ${record.name}`, `Email: ${record.email}`, '', 'Message:', record.message].join('\n'),
    html: renderEmail({
      eyebrow: 'New General Inquiry',
      title: `${record.name} sent a message`,
      intro: 'A new submission came in through the general contact form.',
      fields: [
        { label: 'Name', value: record.name },
        { label: 'Email', value: record.email }
      ],
      longFieldLabel: 'Message',
      longFieldValue: record.message,
      ctaLabel: 'View in Admin Dashboard',
      ctaUrl: buildUrl(req, '/admin')
    })
  }).catch((err) => console.error('[general-inquiry] email failed:', err));

  sendMail({
    to: record.email,
    subject: 'Thanks for reaching out — Boatek Labs',
    text: `Hi ${record.name},\n\nThanks for your message. We'll get back to you soon.\n\n— Boatek Labs`,
    html: renderEmail({
      eyebrow: 'Message received',
      title: `Thanks, ${record.name.split(' ')[0]}`,
      intro: "We've got your message and will get back to you soon.",
      fields: [
        { label: 'Submitted', value: new Date(record.receivedAt).toLocaleString() }
      ],
      ctaLabel: 'Visit Boatek Labs',
      ctaUrl: buildUrl(req, '/index.html')
    })
  }).catch((err) => console.error('[general-inquiry] confirmation email failed:', err));

  return res.status(201).json({ ok: true, id: record.id });
});

module.exports = router;
