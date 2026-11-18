// routes/journal.js
const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');

const router = express.Router();
const store = new JsonStore(path.join(__dirname, '..', 'content', 'journal.json'));

router.get('/', async (req, res) => {
  try {
    let posts = await store.readAll();
    if (req.query.featured === 'true') posts = posts.filter((p) => p.featured);
    posts = posts.slice().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.json(posts);
  } catch (err) {
    console.error('[journal] failed to read journal data:', err);
    res.status(500).json({ error: 'Could not load journal data.' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const posts = await store.readAll();
    const post = posts.find((p) => p.slug === req.params.slug);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Could not load journal data.' });
  }
});

module.exports = router;
