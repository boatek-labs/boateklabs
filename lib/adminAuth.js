const crypto=require('crypto');const db=require('./db');const TTL=12*60*60*1000;
const digest=t=>crypto.createHash('sha256').update(t).digest('hex');
async function createSession(admin){const token=crypto.randomBytes(32).toString('hex');await db.query('INSERT INTO app_admin_sessions(token_hash,admin_id,role,permissions,expires_at) VALUES($1,$2,$3,$4::jsonb,NOW()+INTERVAL \'12 hours\')',[digest(token),admin.id,admin.role,JSON.stringify(admin.permissions||[])]);return token;}
async function getSession(token){if(!token)return null;const r=await db.query('SELECT admin_id AS "adminId",role,permissions,expires_at FROM app_admin_sessions WHERE token_hash=$1 AND expires_at>NOW()',[digest(token)]);return r.rows[0]?{adminId:r.rows[0].adminId,role:r.rows[0].role,permissions:r.rows[0].permissions,expiry:new Date(r.rows[0].expires_at).getTime()}:null;}
async function validateSession(token){return!!(await getSession(token));}
async function destroySession(token){if(token)await db.query('DELETE FROM app_admin_sessions WHERE token_hash=$1',[digest(token)]);}
async function destroySessionsForAdmin(id){await db.query('DELETE FROM app_admin_sessions WHERE admin_id=$1',[id]);}
module.exports={createSession,getSession,validateSession,destroySession,destroySessionsForAdmin};
