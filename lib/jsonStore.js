// Neon-backed JSON store. Committed JSON files are read-only first-run seed data only.
const fs=require('fs/promises');const path=require('path');const db=require('./db');
class JsonStore{
 constructor(filePath){this.filePath=filePath;this.key=path.relative(path.join(__dirname,'..'),filePath).split(path.sep).join('/');}
 async _seed(){let seed=[];try{seed=JSON.parse(await fs.readFile(this.filePath,'utf8'));}catch{} await db.query('INSERT INTO app_json_store(store_key,records) VALUES($1,$2::jsonb) ON CONFLICT(store_key) DO NOTHING',[this.key,JSON.stringify(seed)]);}
 async readValue(){await this._seed();const r=await db.query('SELECT records FROM app_json_store WHERE store_key=$1',[this.key]);return r.rows[0]?.records??[];}
 async readAll(){const value=await this.readValue();return Array.isArray(value)?value:[];}
 async _mutate(fn){await db.ensureSchema();const c=await db.getPool().connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[this.key]);let seed=[];try{seed=JSON.parse(await fs.readFile(this.filePath,'utf8'));}catch{}await c.query('INSERT INTO app_json_store(store_key,records) VALUES($1,$2::jsonb) ON CONFLICT(store_key) DO NOTHING',[this.key,JSON.stringify(seed)]);const q=await c.query('SELECT records FROM app_json_store WHERE store_key=$1 FOR UPDATE',[this.key]);const result=fn(q.rows[0].records);if(result.changed)await c.query('UPDATE app_json_store SET records=$2::jsonb,updated_at=NOW() WHERE store_key=$1',[this.key,JSON.stringify(result.records)]);await c.query('COMMIT');return result.value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async replace(records){return this._mutate(()=>({records,value:records,changed:true}));}
 async append(record){return this._mutate(all=>({records:[...all,record],value:record,changed:true}));}
 async removeById(id){return this._mutate(all=>{const next=all.filter(x=>x.id!==id);return{records:next,value:next.length!==all.length,changed:next.length!==all.length};});}
 async updateById(id,updates){return this._mutate(all=>{const i=all.findIndex(x=>x.id===id);if(i<0)return{records:all,value:null,changed:false};const next=all.slice();next[i]={...next[i],...updates};return{records:next,value:next[i],changed:true};});}
}
module.exports=JsonStore;
