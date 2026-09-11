import {env} from 'cloudflare:workers';
import {encryptKey,decryptKey} from './key-crypto';
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
