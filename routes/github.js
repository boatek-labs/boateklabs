// routes/github.js
const express = require('express');
const { getOrgStats } = require('../lib/githubStats');

const router = express.Router();

router.get('/', async (req, res) => {
  const org = req.query.org;
  if (!org) return res.status(400).json({ error: 'org query parameter is required.' });
  const stats = await getOrgStats(org);
  res.json(stats);
});

module.exports = router;
