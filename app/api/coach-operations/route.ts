import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {accountDataId} from '@/lib/admin-activity';
import {accountScope} from '@/lib/account-scope';
import {applyChanges,operationSchema,validateOperation,type Receipt} from '@/lib/account-operations';
import type {Data} from '@/lib/training';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in again to save this action.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Save this action from Stride.'},403);
 try{
  const raw=await request.text();if(raw.length>2000000)return json({error:'This action is too large.'},413);
  const parsed=operationSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Invalid coach action. Ask for a new suggestion.'},400);
  const op=parsed.data,db=(env as unknown as {DB:D1Database}).DB,userId=(await accountScope(user,request)).id,key=userId+':'+op.id;
  if(request.headers.get('X-Stride-Account')!==userId)return json({error:'Account changed. Reload before saving.'},403);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({action:op.action,payload:op.payload})));
  const fingerprint=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const read=()=>db.prepare('SELECT data,updated_at FROM user_training_data WHERE user_id=?').bind(userId).first<{data:string;updated_at:string}>();
  const receipt=()=>db.prepare('SELECT fingerprint,receipt FROM coach_operations WHERE key=? AND user_id=?').bind(key,userId).first<{fingerprint:string;receipt:string}>();
  async function acknowledged(prior:{fingerprint:string;receipt:string}){if(prior.fingerprint!==fingerprint)return json({error:'This saved action does not match the proposed change. Ask your coach for a new suggestion.'},422);const current=await read();return json({receipt:JSON.parse(prior.receipt),data:current?JSON.parse(current.data):null,updatedAt:current?.updated_at??null})}
  const prior=await receipt();if(prior)return acknowledged(prior);
  const row=await read();if(!row||row.updated_at!==op.expectedRevision)return json({error:'Newer account data exists. Your coach action is preserved for review.',conflict:true},409);
  const before=JSON.parse(row.data) as Data;let next:Data;
  try{next=applyChanges(before,op.payload);validateOperation(before,next,op)}catch(e){return json({error:e instanceof Error?e.message:'Invalid coach action.'},422)}
  const revision=new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString();
  const result:Receipt={id:op.id,action:op.action,revision,committedAt:new Date().toISOString(),targets:[...new Set(op.payload.map(p=>p.path.slice(0,2).join('/')))]};
  try{
   // D1 batch is one transaction. The receipt and compare-and-swap commit succeed together.
   const results=await db.batch([
    db.prepare('INSERT INTO coach_operations (key,user_id,operation_id,fingerprint,receipt) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM user_training_data WHERE user_id=? AND updated_at=?)').bind(key,userId,op.id,fingerprint,JSON.stringify(result),userId,op.expectedRevision),
    db.prepare('UPDATE user_training_data SET data=?,updated_at=? WHERE user_id=? AND updated_at=? AND EXISTS (SELECT 1 FROM coach_operations WHERE key=? AND fingerprint=?)').bind(JSON.stringify(next),revision,userId,op.expectedRevision,key,fingerprint)
   ]);
   if(!results[0].meta.changes||!results[1].meta.changes)return json({error:'Newer account data exists. Review and retry.',conflict:true},409);
  }catch(e){const committed=await receipt();if(committed)return acknowledged(committed);throw e}
  return json({receipt:result,data:next,updatedAt:revision});
 }catch{return json({error:'No save confirmation was received. Retry this same action to check whether it saved.'},503)}
}
