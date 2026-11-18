// routes/admin.js
const express = require('express');
const path = require('path');
const os = require('os');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const JsonStore = require('../lib/jsonStore');
const admins = require('../lib/admins');
const { createSession, getSession, destroySession, destroySessionsForAdmin } = require('../lib/adminAuth');
const { sendMail, isConfigured: isSmtpConfigured } = require('../lib/mailer');
const { renderEmail } = require('../lib/emailTemplates');

const router = express.Router();

const SESSION_COOKIE = 'boatek_admin_session';

const SUBMISSION_STORES = {
  'project-inquiries': new JsonStore(path.join(__dirname, '..', 'data', 'project-inquiries.json')),
  'career-applications': new JsonStore(path.join(__dirname, '..', 'data', 'career-applications.json')),
  'collaboration-requests': new JsonStore(path.join(__dirname, '..', 'data', 'collaboration-requests.json')),
  'general-inquiries': new JsonStore(path.join(__dirname, '..', 'data', 'general-inquiries.json')),
  subscribers: new JsonStore(path.join(__dirname, '..', 'data', 'subscribers.json')),
  messages: new JsonStore(path.join(__dirname, '..', 'data', 'messages.json'))
};

const projectsStore = new JsonStore(path.join(__dirname, '..', 'content', 'projects.json'));
const configStore = new JsonStore(path.join(__dirname, '..', 'config', 'site.json'));
const teamStore = new JsonStore(path.join(__dirname, '..', 'config', 'team.json'));
const journalStore = new JsonStore(path.join(__dirname, '..', 'content', 'journal.json'));
const pageviewsStore = new JsonStore(path.join(__dirname, '..', 'data', 'pageviews.json'));
const newsletterCampaignsStore = new JsonStore(path.join(__dirname, '..', 'data', 'newsletter-campaigns.json'));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please wait before trying again.' }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed.'));
    }
    cb(null, true);
  }
});

async function requireAdmin(req, res, next) {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  const session = await getSession(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  req.adminSession = session;
  next();
}
// Reserved for actions that must always stay with the founder tier, no
// matter what permissions an editor account might hold — managing other
// admin accounts is the one thing that can't be delegated.
function requireSuper(req, res, next) {
  if (!req.adminSession || req.adminSession.role !== 'super') {
    return res.status(403).json({ error: 'This action requires a super admin account.' });
  }
  next();
}
// For everything else: a super account always passes; an editor account
// passes only if they've been explicitly granted this permission key.
function requirePermission(key) {
  return (req, res, next) => {
    if (!req.adminSession) return res.status(401).json({ error: 'Not authenticated.' });
    if (req.adminSession.role === 'super') return next();
    if ((req.adminSession.permissions || []).includes(key)) return next();
    return res.status(403).json({ error: `Your account doesn't have edit access to ${key}.` });
  };
}

function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((k) => set.add(k));
    return set;
  }, new Set()));

  function escapeCell(value) {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  const header = columns.map(escapeCell).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c])).join(','));
  return [header, ...lines].join('\n');
}

// ============================================================ AUTH ============================================================

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const admin = await admins.findByEmail(String(email).trim().toLowerCase());
  if (!admin || !admins.verifyPassword(password, admin.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = await createSession(admin);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12
  });
  res.json({ ok: true, admin: admins.toPublic(admin) });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  await destroySession(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get('/session', async (req, res) => {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  const session = getSession(token);
  if (!session) return res.json({ authenticated: false });
  const admin = await admins.findById(session.adminId);
  if (!admin) return res.json({ authenticated: false });
  res.json({ authenticated: true, admin: admins.toPublic(admin) });
});

router.use(requireAdmin);

router.get('/me', async (req, res) => {
  const admin = await admins.findById(req.adminSession.adminId);
  res.json(admins.toPublic(admin));
});

// ============================================================ ADMIN ACCOUNTS (owner-only) ============================================================

router.get('/admins', requireSuper, async (req, res) => {
  res.json(await admins.listPublic());
});

router.post('/admins', requireSuper, async (req, res) => {
  const { name, email, password, role, permissions } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const admin = await admins.createAdmin({ name, email, password, role, permissions });
    res.status(201).json(admins.toPublic(admin));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/admins/:id/permissions', requireSuper, async (req, res) => {
  const { permissions } = req.body || {};
  const result = await admins.updateAdminPermissions(req.params.id, permissions);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true, admin: admins.toPublic(result.admin) });
});

router.get('/permissions-catalog', requireSuper, (req, res) => {
  res.json({ permissions: admins.VALID_PERMISSIONS });
});

router.delete('/admins/:id', requireSuper, async (req, res) => {
  if (req.params.id === req.adminSession.adminId) {
    return res.status(400).json({ error: 'You cannot delete your own account while logged in as it.' });
  }
  const result = await admins.deleteAdmin(req.params.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  await destroySessionsForAdmin(req.params.id);
  res.json({ ok: true });
});

// ============================================================ OVERVIEW ============================================================

router.get('/overview', (req, res) => {
  const hostGuesses = [
    ['Render', process.env.RENDER],
    ['Railway', process.env.RAILWAY_ENVIRONMENT],
    ['Fly.io', process.env.FLY_APP_NAME],
    ['Vercel', process.env.VERCEL],
    ['Heroku', process.env.DYNO],
    ['Koyeb', process.env.KOYEB_APP_ID],
    ['AWS (Elastic Beanstalk)', process.env.EB_ENVIRONMENT_NAME],
    ['Docker (generic)', process.env.DOCKER_CONTAINER]
  ];
  const detected = hostGuesses.find(([, value]) => !!value);
  const hostingEnvironment = detected ? detected[0] : 'Local / unrecognized host';

  res.json({
    hostingEnvironment,
    nodeEnv: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    smtpConfigured: isSmtpConfigured(),
    port: process.env.PORT || 3000,
    serverTime: new Date().toISOString()
  });
});

// ============================================================ ANALYTICS ============================================================

router.get('/analytics', async (req, res) => {
  try {
    const weekBuckets = 8;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    function bucketLabel(offsetWeeks) {
      const d = new Date(now - offsetWeeks * weekMs);
      return d.toISOString().slice(0, 10);
    }

    const submissionTypes = ['project-inquiries', 'career-applications', 'collaboration-requests', 'general-inquiries'];
    const perWeek = {};
    for (const type of submissionTypes) {
      const rows = await SUBMISSION_STORES[type].readAll();
      const buckets = new Array(weekBuckets).fill(0);
      rows.forEach((r) => {
        const ts = new Date(r.receivedAt).getTime();
        const weeksAgo = Math.floor((now - ts) / weekMs);
        if (weeksAgo >= 0 && weeksAgo < weekBuckets) {
          buckets[weekBuckets - 1 - weeksAgo]++;
        }
      });
      perWeek[type] = buckets;
    }
    const weekLabels = [];
    for (let i = weekBuckets - 1; i >= 0; i--) weekLabels.push(bucketLabel(i));

    const projectInquiries = await SUBMISSION_STORES['project-inquiries'].readAll();
    const typeBreakdown = {};
    projectInquiries.forEach((r) => {
      const t = r.projectType || 'Not specified';
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    });

    const subscribers = await SUBMISSION_STORES.subscribers.readAll();
    const messages = await SUBMISSION_STORES.messages.readAll();

    let pageviews = [];
    try {
      pageviews = await pageviewsStore.readAll();
    } catch {
      pageviews = [];
    }
    const last30 = pageviews.filter((p) => now - new Date(p.timestamp).getTime() < 30 * 24 * 60 * 60 * 1000);
    const pathCounts = {};
    last30.forEach((p) => { pathCounts[p.path] = (pathCounts[p.path] || 0) + 1; });
    const topPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, c]) => ({ path: p, count: c }));
    const uniqueVisitors30d = new Set(last30.map((p) => p.visitorHash)).size;

    res.json({
      weekLabels,
      submissionsPerWeek: perWeek,
      projectTypeBreakdown: typeBreakdown,
      totals: {
        projectInquiries: projectInquiries.length,
        subscribers: subscribers.length,
        messages: messages.length
      },
      pageviews: {
        totalLast30Days: last30.length,
        uniqueVisitorsLast30Days: uniqueVisitors30d,
        topPaths
      }
    });
  } catch (err) {
    console.error('[admin] analytics failed:', err);
    res.status(500).json({ error: 'Could not compute analytics.' });
  }
});

// ============================================================ SITE CONFIG ============================================================

router.get('/config', async (req,res)=>{try{res.json(await configStore.readValue());}catch(e){console.error('[admin] config read failed',e);res.status(500).json({error:'Could not read site config.'});}});
router.put('/config',requirePermission('config'),async(req,res)=>{try{const current=await configStore.readValue();const allowed=['social','contactEmail','supportEmail','statusMessage','location'];const next={...current};for(const k of allowed)if(req.body?.[k]!==undefined)next[k]=req.body[k];await configStore.replace(next);res.json({ok:true,config:next});}catch(e){console.error('[admin] config save failed',e);res.status(500).json({error:'Could not save site config.'});}});

// ============================================================ TEAM ============================================================

router.get('/team',async(req,res)=>{try{res.json(await teamStore.readAll());}catch(e){res.status(500).json({error:'Could not read team data.'});}});
router.put('/team',requirePermission('team'),async(req,res)=>{const incoming=req.body;if(!Array.isArray(incoming)||incoming.some(m=>!m.id||!m.name||!m.role))return res.status(400).json({error:'Team data must be an array; each member needs an id, name, and role.'});try{await teamStore.replace(incoming);res.json({ok:true,team:incoming});}catch(e){console.error('[admin] team save failed',e);res.status(500).json({error:'Could not save team data.'});}});

// ============================================================ PROJECTS CMS ============================================================

router.get('/projects', async (req, res) => {
  res.json(await projectsStore.readAll());
});

router.post('/projects', requirePermission('projects'), async (req, res) => {
  const { title, category, description } = req.body || {};
  if (!title || !category || !description) {
    return res.status(400).json({ error: 'Title, category, and description are required.' });
  }
  const record = {
    id: 'proj-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title, category, description,
    techStack: Array.isArray(req.body.techStack) ? req.body.techStack : [],
    featured: !!req.body.featured,
    link: req.body.link || '',
    githubOrg: req.body.githubOrg || '',
    thumbnailUrl: req.body.thumbnailUrl || '',
    thumbnailVariant: req.body.thumbnailVariant || 'a',
    images: Array.isArray(req.body.images) ? req.body.images : [],
    clientPortal: req.body.clientPortal || { enabled: false, accessCode: '', updates: [] },
    createdAt: new Date().toISOString()
  };
  await projectsStore.append(record);
  res.status(201).json(record);
});

router.put('/projects/:id', requirePermission('projects'), async (req, res) => {
  const updated = await projectsStore.updateById(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Project not found.' });
  res.json(updated);
});

router.delete('/projects/:id', requirePermission('projects'), async (req, res) => {
  const removed = await projectsStore.removeById(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Project not found.' });
  res.json({ ok: true });
});

// ============================================================ JOURNAL CMS ============================================================

router.get('/journal', async (req, res) => {
  res.json(await journalStore.readAll());
});

router.post('/journal', requirePermission('journal'), async (req, res) => {
  const { title, slug, excerpt, body } = req.body || {};
  if (!title || !slug || !excerpt || !body) {
    return res.status(400).json({ error: 'Title, slug, excerpt, and body are required.' });
  }
  const existing = await journalStore.readAll();
  if (existing.some((p) => p.slug === slug)) {
    return res.status(400).json({ error: 'A post with that slug already exists.' });
  }
  const record = {
    id: 'post-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title, slug, excerpt, body,
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    featured: !!req.body.featured,
    publishedAt: req.body.publishedAt || new Date().toISOString()
  };
  await journalStore.append(record);
  res.status(201).json(record);
});

router.put('/journal/:id', requirePermission('journal'), async (req, res) => {
  const updated = await journalStore.updateById(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Post not found.' });
  res.json(updated);
});

router.delete('/journal/:id', requirePermission('journal'), async (req, res) => {
  const removed = await journalStore.removeById(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Post not found.' });
  res.json({ ok: true });
});

// ============================================================ FILE UPLOAD ============================================================

router.post('/upload',requirePermission('projects'),(req,res)=>{upload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message});if(!req.file)return res.status(400).json({error:'No file uploaded.'});try{const id='img-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);const db=require('../lib/db');await db.query('INSERT INTO app_uploads(id,content_type,file_data) VALUES($1,$2,$3)',[id,req.file.mimetype,req.file.buffer]);res.json({ok:true,url:'/api/admin/uploads/'+id});}catch(e){console.error('[admin] upload persistence failed',e);res.status(500).json({error:'Could not save uploaded image.'});}});});
router.get('/uploads/:id',async(req,res)=>{try{const db=require('../lib/db');const result=await db.query('SELECT content_type,file_data FROM app_uploads WHERE id=$1',[req.params.id]);if(!result.rows.length)return res.status(404).end();res.setHeader('Content-Type',result.rows[0].content_type);res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.send(result.rows[0].file_data);}catch(e){console.error('[admin] upload read failed',e);res.status(500).end();}});

// ============================================================ SUBMISSIONS ============================================================

router.get('/data/:type', async (req, res) => {
  const store = SUBMISSION_STORES[req.params.type];
  if (!store) return res.status(404).json({ error: 'Unknown data type.' });
  const all = await store.readAll();
  res.json(all.slice().reverse());
});

router.patch('/data/:type/:id', requirePermission('submissions'), async (req, res) => {
  const store = SUBMISSION_STORES[req.params.type];
  if (!store) return res.status(404).json({ error: 'Unknown data type.' });
  const allowedFields = ['replied', 'note', 'status'];
  const patch = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  const updated = await store.updateById(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'Record not found.' });
  res.json(updated);
});

router.delete('/data/:type/:id', requirePermission('submissions'), async (req, res) => {
  const store = SUBMISSION_STORES[req.params.type];
  if (!store) return res.status(404).json({ error: 'Unknown data type.' });
  const removed = await store.removeById(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Record not found.' });
  res.json({ ok: true });
});

router.get('/export/:type', async (req, res) => {
  const store = SUBMISSION_STORES[req.params.type];
  if (!store) return res.status(404).json({ error: 'Unknown data type.' });
  const rows = await store.readAll();
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}.csv"`);
  res.send(csv);
});

// ============================================================ NEWSLETTER ============================================================

router.post('/newsletter/generate', requirePermission('newsletter'), async (req, res) => {
  const notes = String(req.body?.notes || '').trim();
  const tone = String(req.body?.tone || 'confident, thoughtful, creative');
  if (notes.length < 20) return res.status(400).json({ error: 'Add a little more context (at least 20 characters) for the AI to work with.' });
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'Newsletter AI is not configured. Add OPENROUTER_API_KEY to your server environment.' });
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.SITE_URL || 'https://boateklabs.com', 'X-Title': 'Boatek Labs Newsletter Studio' },
      body: JSON.stringify({
        model: process.env.NEWSLETTER_AI_MODEL || 'openai/gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are the editorial writer for Boatek Labs, a creative technology studio. Turn rough notes into a compelling, substantial newsletter email. Write in natural, thoughtful English, clear sections, strong opening, useful context, a human tone, and a specific closing CTA when appropriate. Avoid fabricated dates, metrics, announcements, names, or facts; only expand supported ideas. Output the email body only, with a subject line on the first line prefixed SUBJECT: and then body. No markdown tables.' },
          { role: 'user', content: `Tone: ${tone}\n\nRough notes and intent:\n${notes}` }
        ]
      })
    });
    const result = await response.json();
    const draft = result?.choices?.[0]?.message?.content?.trim();
    if (!response.ok || !draft) throw new Error(result?.error?.message || 'The AI returned no draft.');
    res.json({ ok: true, draft });
  } catch (error) {
    console.error('[admin] newsletter AI generation failed:', error.message);
    res.status(502).json({ error: 'AI could not draft the newsletter right now. Your notes have not been changed.' });
  }
});

router.post('/newsletter/send', requirePermission('newsletter'), async (req, res) => {
  const { subject, body, audience = 'all' } = req.body || {};
  if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required.' });
  const allSubscribers = await SUBMISSION_STORES.subscribers.readAll();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let subscribers;
  if (audience === 'recent') {
    subscribers = allSubscribers.filter((s) => s.subscribedAt && new Date(s.subscribedAt).getTime() >= cutoff);
  } else if (audience === 'custom') {
    const custom = String(req.body?.customRecipients || '').split(/[;,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!custom.length || custom.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return res.status(400).json({ error: 'Enter valid specific email addresses, separated by commas.' });
    subscribers = custom.map((email) => ({ email }));
  } else {
    subscribers = allSubscribers;
  }
  const recipients = [...new Set(subscribers.map((s) => String(s.email || '').trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
  if (!recipients.length) return res.status(400).json({ error: audience === 'recent' ? 'No recent subscribers in the last 30 days.' : 'There are no subscribers to send to yet.' });

  // Send with blind recipients in manageable batches; never expose the subscriber list.
  const chunks = [];
  for (let i = 0; i < recipients.length; i += 40) chunks.push(recipients.slice(i, i + 40));
  try {
    for (const chunk of chunks) {
      const paragraphs = String(body).split(/\n{2,}/).map((part) => `<p style="margin:0 0 16px;line-height:1.75;color:#e7ecf5">${escapeNewsletterHtml(part).replace(/\n/g, '<br>')}</p>`).join('');
      const html = renderEmail({
        eyebrow: 'Boatek Labs Newsletter',
        title: subject,
        intro: 'Studio updates, ideas, and things worth sharing.',
        fields: [],
        bodyHtml: paragraphs
      });
      const sent = await sendMail({ to: 'undisclosed-recipients:;', bcc: chunk, subject, text: body, html });
      if (!sent.sent && process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured for sending.');
    }
    await newsletterCampaignsStore.append({
      id: 'campaign-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      subject, body, audience, sentTo: recipients.length, sentAt: new Date().toISOString(), sentBy: req.adminSession.adminId
    });
    res.json({ ok: true, sentTo: recipients.length });
  } catch (err) {
    console.error('[admin] newsletter send failed:', err);
    res.status(500).json({ error: 'Could not send the newsletter right now. Some recipient batches may already have been delivered.' });
  }
});

function escapeNewsletterHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

router.get('/newsletter/campaigns', async (req, res) => {
  const campaigns = await newsletterCampaignsStore.readAll();
  res.json(campaigns.slice().reverse());
});

module.exports = router;
