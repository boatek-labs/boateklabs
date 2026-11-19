const { Pool } = require('pg');
let pool, schemaPromise;
function getPool() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Configure it in the Vercel project environment.');
 if (!pool) pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false},max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});
 return pool;
}
async function ensureSchema() {
 if (!schemaPromise) schemaPromise=getPool().query(`
 CREATE TABLE IF NOT EXISTS app_json_store(store_key TEXT PRIMARY KEY,records JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS app_admin_sessions(token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL,role TEXT NOT NULL,permissions JSONB NOT NULL DEFAULT '[]'::jsonb,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS app_admin_sessions_admin_idx ON app_admin_sessions(admin_id);
 CREATE INDEX IF NOT EXISTS app_admin_sessions_expiry_idx ON app_admin_sessions(expires_at);
 CREATE TABLE IF NOT EXISTS app_uploads(id TEXT PRIMARY KEY,content_type TEXT NOT NULL,file_data BYTEA NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS app_users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT,google_sub TEXT UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS app_user_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS app_user_sessions_user_idx ON app_user_sessions(user_id);
 CREATE INDEX IF NOT EXISTS app_user_sessions_expiry_idx ON app_user_sessions(expires_at);
 CREATE TABLE IF NOT EXISTS app_user_saved_projects(user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,project_id TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,project_id));
 `).catch(e=>{schemaPromise=null;throw e;});
 await schemaPromise;
}
async function query(...args){await ensureSchema();return getPool().query(...args);}
module.exports={getPool,ensureSchema,query};
