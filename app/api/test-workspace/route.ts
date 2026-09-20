import {z} from 'zod';
import {dayOffset,TEST_DAY_COOKIE} from '@/lib/fitness-clock';
import {canUseTestWorkspace,isTestOperator,requestedTestWorkspace,TEST_WORKSPACE_COOKIE} from '@/lib/account-scope';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {accountDataId,adminDatabase} from '@/lib/admin-activity';
import {scenarioData,testScenarios,type TestScenario} from '@/lib/test-scenarios';

const input=z.discriminatedUnion('action',[z.object({action:z.literal('clock'),advance:z.union([z.literal(0),z.literal(1),z.literal(7),z.literal(30)])}),z.object({action:z.literal('switch'),mode:z.enum(['live','test'])}),z.object({action:z.literal('scenario'),scenario:z.enum(testScenarios.map(x=>x.id) as [TestScenario,...TestScenario[]])})]);
const json=(body:unknown,status=200,headers?:HeadersInit)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});

export async function POST(request:Request){
 const user=await getChatGPTUser(request);
 if(!user||!await canUseTestWorkspace(user))return json({error:'Test access is required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Open testing from Stride.'},403);
 try{
  const parsed=input.safeParse(await request.json());
  if(!parsed.success)return json({error:'Choose a valid testing action.'},400);
  const id=await accountDataId(user)+':test',db=adminDatabase(),now=new Date().toISOString(),operator=isTestOperator(user);
  if(operator&&parsed.data.action==='switch'&&parsed.data.mode==='live')return json({error:'The test operator only has access to the test workspace.'},403);
  if(parsed.data.action==='clock'){
   if(!operator&&!requestedTestWorkspace(request))return json({error:'Switch to the test workspace first.'},403);
   const offset=parsed.data.advance===0?0:dayOffset(request.headers.get('cookie')||'')+parsed.data.advance;
   if(offset>3650)return json({error:'Reset the test date before advancing further.'},400);
   return json({offset},200,{'Set-Cookie':`${TEST_DAY_COOKIE}=${offset}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`});
  }
  if(parsed.data.action==='switch'){
   if(parsed.data.mode==='test')await db.prepare('INSERT OR IGNORE INTO user_training_data (user_id,data,updated_at) VALUES (?,?,?)').bind(id,JSON.stringify(scenarioData('progression')),now).run();
   const headers=new Headers();headers.append('Set-Cookie',`${TEST_DAY_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);headers.append('Set-Cookie',`${TEST_WORKSPACE_COOKIE}=${parsed.data.mode==='test'?'1':''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${parsed.data.mode==='test'?2592000:0}`);
   return Response.json({mode:parsed.data.mode},{headers});
  }
  const data=scenarioData(parsed.data.scenario);
  await db.batch([db.prepare('INSERT INTO user_training_data (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(id,JSON.stringify(data),now),db.prepare('DELETE FROM weekly_reviews WHERE user_id=?').bind(id),db.prepare('DELETE FROM coach_operations WHERE user_id=?').bind(id),db.prepare('DELETE FROM account_resets WHERE user_id=?').bind(id),db.prepare('DELETE FROM onboarding_drafts WHERE user_id=?').bind(id)]);
  const headers=new Headers({'Cache-Control':'no-store'});headers.append('Set-Cookie',`${TEST_DAY_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);headers.append('Set-Cookie',`stride_test_scenario=${encodeURIComponent(parsed.data.scenario)}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`);
  return json({saved:true,scenario:parsed.data.scenario},200,headers);
 }catch{return json({error:'The test workspace could not be updated. Your live account was not changed.'},503)}
}
