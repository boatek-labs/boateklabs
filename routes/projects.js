// routes/projects.js
const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');

const router = express.Router();
const store = new JsonStore(path.join(__dirname, '..', 'content', 'projects.json'));

router.get('/', async (req, res) => {
  try {
    let projects = await store.readAll();
    if (req.query.category) {
      projects = projects.filter((p) => p.category === req.query.category);
    }
    if (req.query.featured === 'true') {
      projects = projects.filter((p) => p.featured === true);
    }
    projects = projects.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const sanitized = projects.map((p) => {
      const { clientPortal, ...rest } = p;
      return { ...rest, hasClientPortal: !!(clientPortal && clientPortal.enabled) };
    });
    res.json(sanitized);
  } catch (err) {
    console.error('[projects] failed to read projects:', err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

// GET /api/projects/:id — single project for the detail/gallery page
router.get('/:id', async (req, res) => {
  try {
    const projects = await store.readAll();
    const project = projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const { clientPortal, ...rest } = project;
    res.json({ ...rest, hasClientPortal: !!(clientPortal && clientPortal.enabled) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load project.' });
  }
});

module.exports = router;
