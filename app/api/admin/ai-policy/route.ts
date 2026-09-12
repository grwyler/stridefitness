import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {adminDatabase} from '@/lib/admin-activity';

export async function POST(request:Request){
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 const user=await getChatGPTUser(request);
 if(!user||!await isSiteOwner(user))return json({error:'Owner access is required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Update this setting from Stride.'},403);
 const body=await request.json().catch(()=>null) as {included?:unknown}|null;
 if(typeof body?.included!=='boolean')return json({error:'Choose a signup default.'},400);
 try{
  const db=adminDatabase();
  // Capture legacy accounts before changing the default; their access is grandfathered.
  const hasTraining=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_training_data'").first();
  const ids=hasTraining?'SELECT user_id FROM site_users UNION SELECT user_id FROM user_training_data':'SELECT user_id FROM site_users';
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO ai_account_funding (user_id,included) SELECT user_id,COALESCE((SELECT included FROM ai_signup_policy WHERE id='default'),1) FROM ("+ids+")"),
   db.prepare("INSERT INTO ai_signup_policy (id,included) VALUES ('default',?) ON CONFLICT(id) DO UPDATE SET included=excluded.included").bind(body.included?1:0),
  ]);
  return json({included:body.included});
 }catch{return json({error:'Could not update the signup default. Please try again.'},503)}
}
