import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {adminDatabase} from '@/lib/admin-activity';

const bodySchema=z.object({userId:z.string().regex(/^[a-f0-9]{64}$/)});
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 const user=await getChatGPTUser(request);
 if(!user||!await isSiteOwner(user))return json({error:'Owner access is required.'},403);
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin)return json({error:'Reset requests must come from Stride.'},403);
 const parsed=bodySchema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return json({error:'Invalid account.'},400);
 try{
  const db=adminDatabase(),resetAt=new Date().toISOString(),target=parsed.data.userId;
  await db.batch([
   db.prepare('DELETE FROM user_training_data WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM ai_connections WHERE user_id IN (?, ?)').bind(target,`account:${target}`),
   db.prepare('DELETE FROM site_users WHERE user_id = ?').bind(target),
   db.prepare('INSERT INTO account_resets (user_id, reset_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET reset_at = excluded.reset_at').bind(target,resetAt),
  ]);
  return json({reset:true});
 }catch{return json({error:'The account could not be reset. Please try again.'},503)}
}
