const crypto=require('crypto');
const db=require('./db');
const COOKIE='boatek_user_session';
const digest=t=>crypto.createHash('sha256').update(t).digest('hex');
async function createSession(user){const token=crypto.randomBytes(32).toString('hex');await db.query("INSERT INTO app_user_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[digest(token),user.id]);return token;}
async function getUserByToken(token){if(!token)return null;const r=await db.query("SELECT u.id,u.name,u.email,u.created_at AS \"createdAt\" FROM app_user_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",[digest(token)]);return r.rows[0]||null;}
async function getRequestUser(req){return getUserByToken(req.cookies?.[COOKIE]);}
async function destroySession(token){if(token)await db.query('DELETE FROM app_user_sessions WHERE token_hash=$1',[digest(token)]);}
module.exports={COOKIE,createSession,getUserByToken,getRequestUser,destroySession};