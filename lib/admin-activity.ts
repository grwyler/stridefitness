import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
export function adminDatabase(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new Error('Database unavailable');return db}
export async function accountDataId(user:ChatGPTUser){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.email.trim().toLowerCase()))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function hasAiAccess(user:ChatGPTUser){return !await adminDatabase().prepare('SELECT user_id FROM ai_access_blocks WHERE user_id = ?').bind(await accountDataId(user)).first()}
export async function recordActivity(user:ChatGPTUser,ai=false){
 try{
  const hash=await accountDataId(user);
  const now=new Date().toISOString();
  await adminDatabase().prepare('INSERT INTO site_users (user_id,name,email,first_seen,last_seen,ai_requests,last_ai_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,email=excluded.email,last_seen=excluded.last_seen,ai_requests=site_users.ai_requests+excluded.ai_requests,last_ai_at=COALESCE(excluded.last_ai_at,site_users.last_ai_at)').bind(hash,user.fullName||user.displayName,user.email,now,now,ai?1:0,ai?now:null).run();
 }catch{console.error('stride_activity_record_failed')}
}
