// lib/githubStats.js
// Pulls real public stats for a GitHub org (or a single repo) via GitHub's
// REST API, with server-side caching so this app never hammers GitHub's
// unauthenticated rate limit (60 requests/hour) just because a page got a
// few visits. Uses Node's built-in global fetch (Node 18+) — no dependency
// needed.
//
// Cache behavior: successful responses are cached for CACHE_TTL_MS. If a
// fetch fails (network issue, rate limit, org renamed, etc.) and we have a
// previous successful result cached — even if stale — we serve that instead
// of showing broken UI. Only a brand-new org/repo with zero prior successful
// fetch will show the "unavailable" state.

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map(); // key -> { data, fetchedAt }

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'boatek-labs-site', Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API responded ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getOrgStats(org) {
  const cacheKey = `org:${org}`;
  const cached = cache.get(cacheKey);
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return { ...cached.data, cached: true };

  try {
    const orgData = await fetchJson(`https://api.github.com/orgs/${org}`);
    let repos = [];
    try {
      repos = await fetchJson(`https://api.github.com/orgs/${org}/repos?per_page=100&sort=updated`);
    } catch {
      repos = [];
    }

    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const topRepo = repos.slice().sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];

    const result = {
      ok: true,
      org,
      name: orgData.name || org,
      avatarUrl: orgData.avatar_url,
      htmlUrl: orgData.html_url,
      publicRepos: orgData.public_repos ?? repos.length,
      followers: orgData.followers ?? null,
      totalStars,
      topRepo: topRepo ? { name: topRepo.name, stars: topRepo.stargazers_count, url: topRepo.html_url } : null,
      fetchedAt: new Date().toISOString()
    };
    cache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return { ...result, cached: false };
  } catch (err) {
    console.warn(`[githubStats] fetch failed for org "${org}":`, err.message);
    if (cached) {
      return { ...cached.data, cached: true, stale: true };
    }
    return { ok: false, org, error: 'GitHub stats are temporarily unavailable.' };
  }
}

module.exports = { getOrgStats };
