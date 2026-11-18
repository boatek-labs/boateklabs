// routes/config.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'site.json');

router.get('/', (req, res) => {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    res.json(config);
  } catch (err) {
    console.error('[config] failed to read site config:', err);
    res.status(500).json({ error: 'Could not load site configuration.' });
  }
});

module.exports = router;
