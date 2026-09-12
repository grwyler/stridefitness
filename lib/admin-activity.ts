import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
export function adminDatabase(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new Error('Database unavailable');return db}
export async function accountDataId(user:ChatGPTUser){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.email.trim().toLowerCase()))),b=>b.toString(16).padStart(2,'0')).join('')}
// Complimentary access is separate from a user's personal OpenAI connection.
export async function initializeAiFunding(userId:string){
 await adminDatabase().prepare("INSERT OR IGNORE INTO ai_account_funding (user_id, included) SELECT ?, COALESCE((SELECT included FROM ai_signup_policy WHERE id = 'default'), 1)").bind(userId).run();
}
export async function hasAiAccess(user:ChatGPTUser){
 const id=await accountDataId(user);await initializeAiFunding(id);
 const row=await adminDatabase().prepare('SELECT f.included, b.user_id AS blocked FROM ai_account_funding f LEFT JOIN ai_access_blocks b ON b.user_id = f.user_id WHERE f.user_id = ?').bind(id).first<{included:number;blocked:string|null}>();
 return !!row?.included&&!row.blocked;
}
export async function includedAiByDefault(){
 const row=await adminDatabase().prepare("SELECT included FROM ai_signup_policy WHERE id = 'default'").first<{included:number}>();
 return row?!!row.included:true;
}
export async function recordActivity(user:ChatGPTUser,ai=false){
 try{
  const hash=await accountDataId(user);
  await initializeAiFunding(hash);
  const now=new Date().toISOString();
  await adminDatabase().prepare('INSERT INTO site_users (user_id,name,email,first_seen,last_seen,ai_requests,last_ai_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,email=excluded.email,last_seen=excluded.last_seen,ai_requests=site_users.ai_requests+excluded.ai_requests,last_ai_at=COALESCE(excluded.last_ai_at,site_users.last_ai_at)').bind(hash,user.fullName||user.displayName,user.email,now,now,ai?1:0,ai?now:null).run();
 }catch{console.error('stride_activity_record_failed')}
}
