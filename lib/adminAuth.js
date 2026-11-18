// lib/adminAuth.js
// Session auth for the admin dashboard, now tracking which admin account is
// logged in and their role (owner/viewer), not just a single shared password.
//
// Limitation worth knowing: sessions live in this process's memory, so they
// don't survive a server restart and don't share across multiple instances
// behind a load balancer. Fine for a single-instance deploy (which is what the
// file-based JSON storage in this app already assumes); if you scale to
// multiple instances, move this to a shared store (Redis, a database table)
// instead of swapping this file's logic entirely — the interface below
// (createSession / validateSession / destroySession) can stay the same.

const crypto = require('crypto');

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const sessions = new Map(); // token -> { adminId, role, expiry }

function createSession(admin) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    adminId: admin.id,
    role: admin.role,
    permissions: admin.permissions || [],
    expiry: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSession(token) {
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (Date.now() > session.expiry) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function validateSession(token) {
  return !!getSession(token);
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function destroySessionsForAdmin(adminId) {
  for (const [token, session] of sessions.entries()) {
    if (session.adminId === adminId) sessions.delete(token);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiry) sessions.delete(token);
  }
}, 1000 * 60 * 30).unref();

module.exports = { createSession, getSession, validateSession, destroySession, destroySessionsForAdmin };
