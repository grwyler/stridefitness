import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {accountScope} from '@/lib/account-scope';
import {adminDatabase} from '@/lib/admin-activity';
import {onboardingSchema,emptyOnboarding,hasExistingTraining,completeOnboarding} from '@/lib/onboarding';
import type {Data} from '@/lib/training';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const revision=(previous?:string)=>new Date(Math.max(Date.now(),previous?Date.parse(previous)+1:0)).toISOString();
export async function GET(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in to continue.'},401);
 try{const id=(await accountScope(user,request)).id,db=adminDatabase();
 const [row,account]=await Promise.all([db.prepare('SELECT data,updated_at FROM onboarding_drafts WHERE user_id=?').bind(id).first<{data:string;updated_at:string}>(),db.prepare('SELECT data,updated_at FROM user_training_data WHERE user_id=?').bind(id).first<{data:string;updated_at:string}>()]);
 return json({draft:row?onboardingSchema.parse(JSON.parse(row.data)):emptyOnboarding((user.fullName||user.displayName||'').slice(0,80)),updatedAt:row?.updated_at??null,accountUpdatedAt:account?.updated_at??null,complete:hasExistingTraining(account?JSON.parse(account.data):null)});
 }catch{return json({error:'Your setup could not be loaded. Please retry.'},503)}
}
const input=z.object({draft:onboardingSchema,baseUpdatedAt:z.string().nullable(),accountUpdatedAt:z.string().nullable().optional(),complete:z.boolean().default(false),acceptPlan:z.boolean().default(false)});
export async function PUT(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in to continue.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Save setup from Stride.'},403);
 try{const raw=await request.text();if(raw.length>150000)return json({error:'Please shorten your setup.'},413);const parsed=input.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Check your answers and try again.'},400);
 const body=parsed.data,id=(await accountScope(user,request)).id,db=adminDatabase();
 const row=await db.prepare('SELECT data,updated_at FROM onboarding_drafts WHERE user_id=?').bind(id).first<{data:string;updated_at:string}>();
 if((row?.updated_at??null)!==body.baseUpdatedAt)return json({error:'Setup changed on another device. Reload to use the latest saved answers.'},409);
 if(body.complete){
 const account=await db.prepare('SELECT data,updated_at FROM user_training_data WHERE user_id=?').bind(id).first<{data:string;updated_at:string}>();
 if((account?.updated_at??null)!==(body.accountUpdatedAt??null))return json({error:'Your account changed elsewhere. Reload before saving setup.'},409);
 const current:Data|null=account?JSON.parse(account.data):null;
 if(hasExistingTraining(current))return json({error:'Your account is already set up. Open Stride to continue.'},409);
 if(!body.draft.profile.sex)return json({error:'Choose a body map before continuing.'},400);
 const data=completeOnboarding(current,body.draft,body.acceptPlan),now=revision(account?.updated_at);
 const saved=account?await db.prepare('UPDATE user_training_data SET data=?,updated_at=? WHERE user_id=? AND updated_at=?').bind(JSON.stringify(data),now,id,account.updated_at).run():await db.prepare('INSERT OR IGNORE INTO user_training_data (user_id,data,updated_at) VALUES (?,?,?)').bind(id,JSON.stringify(data),now).run();
 if(!saved.meta.changes)return json({error:'Your account changed elsewhere. Reload before saving setup.'},409);
 // Account initialization above is atomic. A retry never appends duplicate templates.
 await db.prepare('DELETE FROM onboarding_drafts WHERE user_id=? AND updated_at=?').bind(id,body.baseUpdatedAt).run().catch(()=>console.error('stride_onboarding_cleanup_failed'));
 return json({complete:true});
 }
 const now=revision(row?.updated_at),serialized=JSON.stringify(body.draft);
 const saved=row?await db.prepare('UPDATE onboarding_drafts SET data=?,updated_at=? WHERE user_id=? AND updated_at=?').bind(serialized,now,id,row.updated_at).run():await db.prepare('INSERT OR IGNORE INTO onboarding_drafts (user_id,data,updated_at) VALUES (?,?,?)').bind(id,serialized,now).run();
 if(!saved.meta.changes)return json({error:'Setup changed on another device. Reload to continue.'},409);
 return json({updatedAt:now});
 }catch{return json({error:'Setup could not be saved. Your answers are still here; please retry.'},503)}
}
