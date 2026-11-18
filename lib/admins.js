// lib/admins.js
// Manages admin user accounts (data/admins.json). Two account types:
//
//   - 'super'  : full control of everything, including managing other admin
//                accounts. This is the founder/owner tier — there should
//                usually only be one or two of these.
//   - 'editor' : scoped access. An editor is only granted write access to the
//                specific sections listed in their `permissions` array
//                (e.g. ["projects", "journal"]). This mirrors the way team
//                members already have specific disciplines/responsibilities
//                assigned in config/team.json — an editor's dashboard access
//                is scoped to what they're actually responsible for, not
//                all-or-nothing.
//
// Valid permission keys: 'projects', 'journal', 'team', 'config',
// 'submissions', 'newsletter'. Editors can always *view* every panel; these
// keys only control whether their edit/delete/send controls are enabled.
// Managing other admin accounts is reserved for 'super' regardless of any
// permissions an editor holds — that boundary can't be granted away.
//
// Passwords are hashed with bcryptjs (pure-JS, no native build step needed —
// important for easy deploys across hosting platforms).

const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');

const ADMINS_PATH = path.join(__dirname, '..', 'data', 'admins.json');
const SALT_ROUNDS = 10;

const VALID_PERMISSIONS = ['projects', 'journal', 'team', 'config', 'submissions', 'newsletter'];

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

function sanitizePermissions(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((p) => VALID_PERMISSIONS.includes(p));
}

async function readAdmins() {
  try {
    const raw = await fs.readFile(ADMINS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // Backward compatibility: older data may use role 'owner'/'viewer' from
    // before this two-tier system existed. Treat 'owner' as 'super' and
    // 'viewer' as an 'editor' with no permissions, transparently.
    return parsed.map((a) => {
      if (a.role === 'owner') return { ...a, role: 'super' };
      if (a.role === 'viewer') return { ...a, role: 'editor', permissions: a.permissions || [] };
      return a;
    });
  } catch {
    return [];
  }
}

async function writeAdmins(admins) {
  await fs.mkdir(path.dirname(ADMINS_PATH), { recursive: true });
  await fs.writeFile(ADMINS_PATH, JSON.stringify(admins, null, 2), 'utf-8');
}

async function bootstrapDefaultAdmin() {
  const admins = await readAdmins();
  if (admins.length > 0) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@boateklabs.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'changeme';

  const superAdmin = {
    id: 'admin-' + Date.now().toString(36),
    name: 'Studio Owner',
    email,
    passwordHash: hashPassword(password),
    role: 'super',
    permissions: VALID_PERMISSIONS.slice(),
    createdAt: new Date().toISOString()
  };
  await writeAdmins([superAdmin]);
  console.log(`[admins] Bootstrapped first super admin account: ${superAdmin.email} (password from ADMIN_PASSWORD in .env)`);
}

async function findByEmail(email) {
  const admins = await readAdmins();
  return admins.find((a) => String(a.email || '').trim().toLowerCase() === String(email).trim().toLowerCase()) || null;
}

async function findById(id) {
  const admins = await readAdmins();
  return admins.find((a) => a.id === id) || null;
}

async function createAdmin({ name, email, password, role, permissions }) {
  const admins = await readAdmins();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (admins.some((a) => a.email === normalizedEmail)) {
    throw new Error('An admin with that email already exists.');
  }
  const finalRole = role === 'super' ? 'super' : 'editor';
  const admin = {
    id: 'admin-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role: finalRole,
    // A super account implicitly has every permission; an editor only has
    // what's explicitly assigned.
    permissions: finalRole === 'super' ? VALID_PERMISSIONS.slice() : sanitizePermissions(permissions),
    createdAt: new Date().toISOString()
  };
  admins.push(admin);
  await writeAdmins(admins);
  return admin;
}

async function updateAdminPermissions(id, permissions) {
  const admins = await readAdmins();
  const target = admins.find((a) => a.id === id);
  if (!target) return { ok: false, error: 'Admin not found.' };
  if (target.role === 'super') {
    return { ok: false, error: "Super admin accounts always have full access — permissions can't be restricted." };
  }
  target.permissions = sanitizePermissions(permissions);
  await writeAdmins(admins);
  return { ok: true, admin: target };
}

async function deleteAdmin(id) {
  const admins = await readAdmins();
  const target = admins.find((a) => a.id === id);
  if (!target) return { ok: false, error: 'Admin not found.' };

  const superCount = admins.filter((a) => a.role === 'super').length;
  if (target.role === 'super' && superCount <= 1) {
    return { ok: false, error: 'Cannot delete the last remaining super admin account.' };
  }
  const next = admins.filter((a) => a.id !== id);
  await writeAdmins(next);
  return { ok: true };
}

function toPublic(admin) {
  if (!admin) return null;
  const { passwordHash, ...safe } = admin;
  return safe;
}

async function listPublic() {
  const admins = await readAdmins();
  return admins.map(toPublic);
}

module.exports = {
  bootstrapDefaultAdmin,
  findByEmail,
  findById,
  createAdmin,
  updateAdminPermissions,
  deleteAdmin,
  verifyPassword,
  toPublic,
  listPublic,
  VALID_PERMISSIONS
};
