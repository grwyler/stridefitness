import {env} from 'cloudflare:workers';
import {legacyAccountId} from '@/lib/auth-identities';
import {adminDatabase} from '@/lib/admin-activity';

type RecordValue=Record<string,unknown>;
function isRecord(value:unknown):value is RecordValue{return !!value&&typeof value==='object'&&!Array.isArray(value)}
function merge(oldValue:unknown,newValue:unknown):unknown{
 if(Array.isArray(oldValue)&&Array.isArray(newValue)){
  const keyed=oldValue.every(item=>isRecord(item)&&typeof item.id==='string')&&newValue.every(item=>isRecord(item)&&typeof item.id==='string');
  if(!keyed)return newValue.length?newValue:oldValue;
  const values=new Map(oldValue.map(item=>[(item as RecordValue).id as string,item]));for(const item of newValue)values.set((item as RecordValue).id as string,item);return [...values.values()];
 }
 if(isRecord(oldValue)&&isRecord(newValue)){const result:RecordValue={...oldValue};for(const [key,value] of Object.entries(newValue))result[key]=key in oldValue?merge(oldValue[key],value):value;return result}
 return newValue??oldValue;
}
async function same(left:string,right:string){const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));const [a,b]=await Promise.all([digest(left),digest(right)]);let difference=0;for(let index=0;index<a.length;index+=1)difference|=a[index]^b[index];return difference===0}

export async function POST(request:Request){
 const config=env as unknown as {ACCOUNT_MIGRATION_SECRET?:string};
 if(!config.ACCOUNT_MIGRATION_SECRET||!await same(request.headers.get('x-account-migration-secret')||'',config.ACCOUNT_MIGRATION_SECRET))return Response.json({error:'Migration access is unavailable.'},{status:404});
 const body=await request.json().catch(()=>null) as {oldEmail?:unknown;newEmail?:unknown}|null,oldEmail=typeof body?.oldEmail==='string'?body.oldEmail.trim().toLowerCase():'',newEmail=typeof body?.newEmail==='string'?body.newEmail.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oldEmail)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)||oldEmail===newEmail)return Response.json({error:'Valid distinct email addresses are required.'},{status:400});
 const db=adminDatabase();
 try{
  const oldIdentity=await db.prepare('SELECT user_id FROM auth_identities WHERE email=?').bind(oldEmail).first<{user_id:string}>(),newIdentity=await db.prepare('SELECT user_id FROM auth_identities WHERE email=?').bind(newEmail).first<{user_id:string}>();
  if(!newIdentity)return Response.json({error:'The new account has not signed in yet.'},{status:404});
  const target=newIdentity.user_id,sourceIds=[await legacyAccountId(oldEmail),oldIdentity?.user_id].filter((value,index,items):value is string=>!!value&&value!==target&&items.indexOf(value)===index);
  if(!sourceIds.length)return Response.json({error:'No separate history was found for the old account.'},{status:404});
  const dataRows=await db.prepare(`SELECT user_id,data FROM user_training_data WHERE user_id IN (${sourceIds.map(()=>'?').join(',')}) OR user_id=?`).bind(...sourceIds,target).all<{user_id:string;data:string}>();
  let merged:unknown={};let found=0;for(const row of dataRows.results){try{const parsed=JSON.parse(row.data);if(row.user_id===target)merged=merge(merged,parsed);else{merged=merge(parsed,merged);found+=1}}catch{}}
  const sourcePlaceholders=sourceIds.map(()=>'?').join(',');
  const statements=[
   db.prepare(`DELETE FROM user_training_data WHERE user_id IN (${sourcePlaceholders}) OR user_id=?`).bind(...sourceIds,target),
   db.prepare('INSERT INTO user_training_data (user_id,data,updated_at) VALUES (?,?,?)').bind(target,JSON.stringify(merged),new Date().toISOString()),
   db.prepare(`UPDATE feedback SET user_id=? WHERE user_id IN (${sourcePlaceholders})`).bind(target,...sourceIds),
   db.prepare(`UPDATE weekly_reviews SET user_id=? WHERE user_id IN (${sourcePlaceholders})`).bind(target,...sourceIds),
   db.prepare(`UPDATE coach_operations SET user_id=? WHERE user_id IN (${sourcePlaceholders})`).bind(target,...sourceIds),
   db.prepare(`UPDATE billing_topups SET user_id=? WHERE user_id IN (${sourcePlaceholders})`).bind(target,...sourceIds),
   db.prepare(`UPDATE ai_usage_charges SET user_id=? WHERE user_id IN (${sourcePlaceholders})`).bind(target,...sourceIds),
   db.prepare(`DELETE FROM onboarding_drafts WHERE user_id IN (${sourcePlaceholders})`).bind(...sourceIds),
   db.prepare(`DELETE FROM account_resets WHERE user_id IN (${sourcePlaceholders})`).bind(...sourceIds),
   db.prepare(`DELETE FROM ai_connections WHERE user_id IN (${sourcePlaceholders}) OR user_id IN (${sourceIds.map(()=>'?').join(',')})`).bind(...sourceIds,...sourceIds.map(id=>`account:${id}`)),
   db.prepare(`DELETE FROM ai_access_blocks WHERE user_id IN (${sourcePlaceholders})`).bind(...sourceIds),
   db.prepare(`DELETE FROM ai_account_funding WHERE user_id IN (${sourcePlaceholders})`).bind(...sourceIds),
   db.prepare(`DELETE FROM billing_accounts WHERE user_id IN (${sourcePlaceholders})`).bind(...sourceIds),
   db.prepare(`DELETE FROM site_users WHERE user_id IN (${sourcePlaceholders})`).bind(...sourceIds),
   db.prepare(`DELETE FROM stride_users WHERE id IN (${sourcePlaceholders})`).bind(...sourceIds),
   db.prepare('DELETE FROM auth_identities WHERE email=?').bind(oldEmail),
  ];
  await db.batch(statements);
  return Response.json({ok:true,migratedTrainingRecords:found,target});
 }catch{return Response.json({error:'The history migration could not be completed.'},{status:503})}
}
