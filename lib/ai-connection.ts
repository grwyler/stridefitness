import {env} from 'cloudflare:workers';
import {encryptKey,decryptKey} from './key-crypto';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {hasAiAccess} from './admin-activity';
function settings(){
 const config=env as unknown as {DB?:D1Database;AI_KEY_ENCRYPTION_SECRET?:string};
 if(!config.DB||!config.AI_KEY_ENCRYPTION_SECRET)throw new Error('AI connection storage is unavailable.');
 return {db:config.DB,secret:config.AI_KEY_ENCRYPTION_SECRET};
}
export async function hasConnection(userId:string){
 const {db}=settings();
 return !!await db.prepare('SELECT user_id FROM ai_connections WHERE user_id = ?').bind(userId).first();
}
export async function saveConnection(userId:string,key:string){
 const {db,secret}=settings();
 const cipher=await encryptKey(key,userId,secret);
 await db.prepare('INSERT INTO ai_connections (user_id, encrypted_key, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at').bind(userId,cipher,new Date().toISOString()).run();
}
export async function getConnectionKey(userId:string){
 const {db,secret}=settings();
 const row=await db.prepare('SELECT encrypted_key FROM ai_connections WHERE user_id = ?').bind(userId).first<{encrypted_key:string}>();
 return row?decryptKey(row.encrypted_key,userId,secret):null;
}
export async function removeConnection(userId:string){
 const {db}=settings();
 await db.prepare('DELETE FROM ai_connections WHERE user_id = ?').bind(userId).run();
}

async function emailHash(email:string){
 const bytes=new TextEncoder().encode(email.trim().toLowerCase());
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function stableConnectionId(user:ChatGPTUser){
 return 'account:'+await emailHash(user.email);
}
export async function hasUserConnection(user:ChatGPTUser){
 const stableId=await stableConnectionId(user);
 if(await hasConnection(stableId)){if(!await hasConnection(user.userId)){const saved=await getConnectionKey(stableId);if(saved)await saveConnection(user.userId,saved)}return true}
 try{const legacy=await getConnectionKey(user.userId);if(!legacy)return false;await saveConnection(stableId,legacy);return true}catch{return false}
}
export async function saveUserConnection(user:ChatGPTUser,key:string){const stableId=await stableConnectionId(user);await saveConnection(stableId,key);if(stableId!==user.userId)await saveConnection(user.userId,key);if(await isSiteOwner(user)&&!await hasConnection(SHARED_DISABLED_ID))await saveConnection(SHARED_ID,key)}
export async function getUserConnectionKey(user:ChatGPTUser){

 const stableId=await stableConnectionId(user),saved=await getConnectionKey(stableId);if(saved)return saved;
 const legacy=await getConnectionKey(user.userId);if(legacy)await saveConnection(stableId,legacy);return legacy;
}
export async function removeUserConnection(user:ChatGPTUser){const stableId=await stableConnectionId(user);await removeConnection(stableId);if(stableId!==user.userId)await removeConnection(user.userId)}

const SHARED_ID='shared:site';
const SHARED_DISABLED_ID='shared:disabled';
export async function getSharedConnectionKey(){
 if(await hasConnection(SHARED_DISABLED_ID))return null;
 const shared=await getConnectionKey(SHARED_ID);
 const config=env as unknown as {SITE_OWNER_USER_ID?:string;SITE_OWNER_EMAIL_HASH?:string;OPENAI_API_KEY?:string};
 const candidates=[config.SITE_OWNER_EMAIL_HASH?`account:${config.SITE_OWNER_EMAIL_HASH}`:null,config.SITE_OWNER_USER_ID].filter((id):id is string=>!!id);
 for(const id of candidates){const key=await getConnectionKey(id);if(key){if(key!==shared)await saveConnection(SHARED_ID,key);return key}}
 return shared||config.OPENAI_API_KEY||null;
}
export async function hasSharedConnection(){return !!await getSharedConnectionKey()}
export async function shareUserConnection(user:ChatGPTUser){const key=await getUserConnectionKey(user);if(!key)throw new Error('Connect your AI key before sharing it.');await saveConnection(SHARED_ID,key);await removeConnection(SHARED_DISABLED_ID)}
export async function removeSharedConnection(){await saveConnection(SHARED_DISABLED_ID,'disabled');await removeConnection(SHARED_ID)}
export async function isSiteOwner(user:ChatGPTUser){const config=env as unknown as {SITE_OWNER_USER_ID?:string;SITE_OWNER_EMAIL_HASH?:string};if(config.SITE_OWNER_USER_ID&&user.userId===config.SITE_OWNER_USER_ID)return true;return !!config.SITE_OWNER_EMAIL_HASH&&await emailHash(user.email)===config.SITE_OWNER_EMAIL_HASH}
export async function consumeSharedAllowance(request:Request){
 const {db}=settings();const raw=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));const visitor=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').slice(0,24),day=new Date().toISOString().slice(0,10),id=`${day}:${visitor}`;
 await db.prepare('CREATE TABLE IF NOT EXISTS ai_daily_usage (id TEXT PRIMARY KEY, request_count INTEGER NOT NULL, updated_at TEXT NOT NULL)').run();
 await db.prepare('INSERT INTO ai_daily_usage (id, request_count, updated_at) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at').bind(id,new Date().toISOString()).run();
 const row=await db.prepare('SELECT request_count FROM ai_daily_usage WHERE id = ?').bind(id).first<{request_count:number}>();return (row?.request_count||0)<=20;
}

// Every coach must resolve funding here; an environment key is owner-funded too.
export async function resolveAIConnection(user:ChatGPTUser){
 const personal=await getUserConnectionKey(user);
 if(personal)return {apiKey:personal,shared:false};
 if(!await hasAiAccess(user))return {apiKey:null,shared:false};
 const apiKey=await getSharedConnectionKey();
 return {apiKey,shared:!!apiKey};
}
