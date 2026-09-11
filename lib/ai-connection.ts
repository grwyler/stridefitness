import {env} from 'cloudflare:workers';
import {encryptKey,decryptKey} from './key-crypto';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
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

async function stableConnectionId(user:ChatGPTUser){
 const bytes=new TextEncoder().encode(user.email.trim().toLowerCase());
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return 'account:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function hasUserConnection(user:ChatGPTUser){
 const stableId=await stableConnectionId(user);
 if(await hasConnection(stableId)){if(!await hasConnection(user.userId)){const saved=await getConnectionKey(stableId);if(saved)await saveConnection(user.userId,saved)}return true}
 try{const legacy=await getConnectionKey(user.userId);if(!legacy)return false;await saveConnection(stableId,legacy);return true}catch{return false}
}
export async function saveUserConnection(user:ChatGPTUser,key:string){const stableId=await stableConnectionId(user);await saveConnection(stableId,key);if(stableId!==user.userId)await saveConnection(user.userId,key)}
export async function getUserConnectionKey(user:ChatGPTUser){
 const stableId=await stableConnectionId(user),saved=await getConnectionKey(stableId);if(saved)return saved;
 const legacy=await getConnectionKey(user.userId);if(legacy)await saveConnection(stableId,legacy);return legacy;
}
export async function removeUserConnection(user:ChatGPTUser){const stableId=await stableConnectionId(user);await removeConnection(stableId);if(stableId!==user.userId)await removeConnection(user.userId)}
