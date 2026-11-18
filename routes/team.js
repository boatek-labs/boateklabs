// routes/team.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const TEAM_PATH = path.join(__dirname, '..', 'config', 'team.json');

router.get('/', (req, res) => {
  try {
    const raw = fs.readFileSync(TEAM_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('[team] failed to read team data:', err);
    res.status(500).json({ error: 'Could not load team data.' });
  }
});

module.exports = router;
