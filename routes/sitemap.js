// routes/sitemap.js
const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');
const { buildUrl } = require('../lib/siteUrl');

const router = express.Router();
const projectsStore = new JsonStore(path.join(__dirname, '..', 'content', 'projects.json'));
const journalStore = new JsonStore(path.join(__dirname, '..', 'content', 'journal.json'));

const STATIC_PAGES = [
  { path: '/index.html', priority: '1.0' },
  { path: '/work.html', priority: '0.9' },
  { path: '/games.html', priority: '0.8' },
  { path: '/software.html', priority: '0.8' },
  { path: '/team.html', priority: '0.7' },
  { path: '/journal.html', priority: '0.6' },
  { path: '/contact.html', priority: '0.8' },
  { path: '/start-a-project.html', priority: '0.9' },
  { path: '/join-the-team.html', priority: '0.7' },
  { path: '/collaborate.html', priority: '0.7' },
  { path: '/general-inquiry.html', priority: '0.5' },
  { path: '/privacy.html', priority: '0.3' }
];

router.get('/', async (req, res) => {
  try {
    const [projects, posts] = await Promise.all([projectsStore.readAll(), journalStore.readAll()]);

    const staticUrls = STATIC_PAGES.map(
      (p) => `  <url><loc>${buildUrl(req, p.path)}</loc><priority>${p.priority}</priority></url>`
    );
    const projectUrls = projects.map(
      (p) => `  <url><loc>${buildUrl(req, `/project.html?id=${encodeURIComponent(p.id)}`)}</loc><priority>0.6</priority></url>`
    );
    const postUrls = posts.map(
      (p) => `  <url><loc>${buildUrl(req, `/journal-post.html?slug=${encodeURIComponent(p.slug)}`)}</loc><priority>0.5</priority></url>`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...projectUrls, ...postUrls].join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('[sitemap] failed to build sitemap:', err);
    res.status(500).send('Could not build sitemap.');
  }
});

module.exports = router;
