// routes/rss.js
const express = require('express');
const path = require('path');
const JsonStore = require('../lib/jsonStore');
const { buildUrl } = require('../lib/siteUrl');

const router = express.Router();
const store = new JsonStore(path.join(__dirname, '..', 'content', 'journal.json'));

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

router.get('/', async (req, res) => {
  try {
    const posts = (await store.readAll())
      .slice()
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    const siteUrl = buildUrl(req, '/');
    const items = posts.map((p) => {
      const postUrl = buildUrl(req, `/journal-post.html?slug=${encodeURIComponent(p.slug)}`);
      return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <description>${escapeXml(p.excerpt)}</description>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      ${(p.tags || []).map((t) => `<category>${escapeXml(t)}</category>`).join('')}
    </item>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Boatek Labs Journal</title>
    <link>${escapeXml(buildUrl(req, '/journal.html'))}</link>
    <description>Devlogs, design notes, and studio updates from Boatek Labs.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('[rss] failed to build feed:', err);
    res.status(500).send('Could not build RSS feed.');
  }
});

module.exports = router;
