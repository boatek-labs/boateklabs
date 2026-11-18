const path=require('path');const bcrypt=require('bcryptjs');const JsonStore=require('./jsonStore');
const store=new JsonStore(path.join(__dirname,'..','data','admins.json'));const SALT_ROUNDS=10;
const VALID_PERMISSIONS=['projects','journal','team','config','submissions','newsletter'];
const hashPassword=p=>bcrypt.hashSync(p,SALT_ROUNDS);
function verifyPassword(p,h){if(!p||!h)return false;try{return bcrypt.compareSync(p,h);}catch{return false;}}
const sanitizePermissions=p=>Array.isArray(p)?p.filter(x=>VALID_PERMISSIONS.includes(x)):[];
async function readAdmins(){return(await store.readAll()).map(a=>a.role==='owner'?{...a,role:'super'}:a.role==='viewer'?{...a,role:'editor',permissions:a.permissions||[]}:a);}
async function bootstrapDefaultAdmin(){const all=await readAdmins();if(all.length)return;const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),password=process.env.ADMIN_PASSWORD||'';if(!email||!password){console.warn('[admins] Set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap the first admin.');return;}await store.append({id:'admin-'+Date.now().toString(36),name:'Studio Owner',email,passwordHash:hashPassword(password),role:'super',permissions:VALID_PERMISSIONS.slice(),createdAt:new Date().toISOString()});console.log('[admins] Initial super admin created.');}
async function findByEmail(email){return(await readAdmins()).find(a=>String(a.email||'').trim().toLowerCase()===String(email).trim().toLowerCase())||null;}
async function findById(id){return(await readAdmins()).find(a=>a.id===id)||null;}
async function createAdmin({name,email,password,role,permissions}){const normalized=String(email).trim().toLowerCase();if(await findByEmail(normalized))throw Error('An admin with that email already exists.');const finalRole=role==='super'?'super':'editor';const admin={id:'admin-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,email:normalized,passwordHash:hashPassword(password),role:finalRole,permissions:finalRole==='super'?VALID_PERMISSIONS.slice():sanitizePermissions(permissions),createdAt:new Date().toISOString()};await store.append(admin);return admin;}
async function updateAdminPermissions(id,permissions){const target=await findById(id);if(!target)return{ok:false,error:'Admin not found.'};if(target.role==='super')return{ok:false,error:"Super admin accounts always have full access — permissions can't be restricted."};return{ok:true,admin:await store.updateById(id,{permissions:sanitizePermissions(permissions)})};}
async function deleteAdmin(id){const all=await readAdmins(),target=all.find(a=>a.id===id);if(!target)return{ok:false,error:'Admin not found.'};if(target.role==='super'&&all.filter(a=>a.role==='super').length<=1)return{ok:false,error:'Cannot delete the last remaining super admin account.'};await store.removeById(id);return{ok:true};}
function toPublic(a){if(!a)return null;const{passwordHash,...safe}=a;return safe;}
async function listPublic(){return(await readAdmins()).map(toPublic);}
module.exports={bootstrapDefaultAdmin,findByEmail,findById,createAdmin,updateAdminPermissions,deleteAdmin,verifyPassword,toPublic,listPublic,VALID_PERMISSIONS};
