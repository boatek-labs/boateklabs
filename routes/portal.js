// routes/portal.js
const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');

const router = express.Router();
const store = new JsonStore(path.join(__dirname, '..', 'content', 'projects.json'));

// GET /api/portal/:projectId/status — safe to call without the access code;
// reveals only whether there's a recent update, never the update content
// itself, so the portal gate can nudge a client to check in without leaking
// anything to someone who doesn't have the code.
router.get('/:projectId/status', async (req, res) => {
  const projects = await store.readAll();
  const project = projects.find((p) => p.id === req.params.projectId);

  if (!project || !project.clientPortal || !project.clientPortal.enabled) {
    return res.status(404).json({ error: 'No client portal exists for this project.' });
  }

  const updates = project.clientPortal.updates || [];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const hasRecentUpdate = updates.some((u) => new Date(u.date).getTime() > sevenDaysAgo);

  res.json({ ok: true, hasRecentUpdate });
});

router.post('/:projectId/verify', async (req, res) => {
  const { code } = req.body || {};
  const projects = await store.readAll();
  const project = projects.find((p) => p.id === req.params.projectId);

  if (!project || !project.clientPortal || !project.clientPortal.enabled) {
    return res.status(404).json({ error: 'No client portal exists for this project.' });
  }
  if (!code || code !== project.clientPortal.accessCode) {
    return res.status(401).json({ error: 'Incorrect access code.' });
  }

  res.json({
    ok: true,
    project: { id: project.id, title: project.title, description: project.description },
    updates: (project.clientPortal.updates || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date))
  });
});

module.exports = router;
