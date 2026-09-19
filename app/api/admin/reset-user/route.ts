import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {adminDatabase} from '@/lib/admin-activity';

// Live account IDs are email hashes or generated guest IDs; the owner's
// isolated test workspace adds the only supported suffix. Keep arbitrary
// database keys out of admin actions.
const accountId=/^(?:[a-f0-9]{64}|guest:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})(?::test)?$/;
const bodySchema=z.object({userId:z.string().regex(accountId),action:z.enum(['reset','delete','grant_ai','revoke_ai'])});
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
  if(parsed.data.action==='grant_ai'){await db.batch([db.prepare('DELETE FROM ai_access_blocks WHERE user_id = ?').bind(target),db.prepare('INSERT INTO ai_account_funding (user_id, included) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET included = 1').bind(target)]);return json({done:true,action:parsed.data.action})}
  if(parsed.data.action==='revoke_ai'){await db.prepare('INSERT INTO ai_access_blocks (user_id, revoked_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET revoked_at = excluded.revoked_at').bind(target,resetAt).run();return json({done:true,action:parsed.data.action})}
  const statements=[
   db.prepare('DELETE FROM weekly_reviews WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM user_training_data WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM onboarding_drafts WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM ai_connections WHERE user_id IN (?, ?)').bind(target,`account:${target}`),
   db.prepare('DELETE FROM ai_usage_charges WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM billing_topups WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM billing_accounts WHERE user_id = ?').bind(target),
   db.prepare('INSERT INTO account_resets (user_id, reset_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET reset_at = excluded.reset_at').bind(target,resetAt),
   parsed.data.action==='delete'
    ?db.prepare('DELETE FROM site_users WHERE user_id = ?').bind(target)
    :db.prepare('UPDATE site_users SET ai_requests = 0, last_ai_at = NULL, last_seen = ? WHERE user_id = ?').bind(resetAt,target),
  ];
  if(parsed.data.action==='delete')statements.push(
   db.prepare('DELETE FROM ai_access_blocks WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM ai_account_funding WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM auth_identities WHERE user_id = ?').bind(target),
   db.prepare('DELETE FROM stride_users WHERE id = ?').bind(target),
   db.prepare('DELETE FROM account_resets WHERE user_id = ?').bind(target),
  );
  await db.batch(statements);
  return json({done:true,action:parsed.data.action});
 }catch{return json({error:'The account change could not be completed. Please try again.'},503)}
}
