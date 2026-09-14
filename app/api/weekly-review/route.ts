import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {accountDataId} from '@/lib/admin-activity';
import {accountScope} from '@/lib/account-scope';
import {initialData,migrateData,type Data} from '@/lib/training';
import {analyzeWeek,reviewBasis,shiftDay,targetSchema,validDay,type WeeklyReview} from '@/lib/weekly-review';
import {changes,validateOperation,type Operation} from '@/lib/account-operations';
import {loadReview,recentReviews,reviewDatabase,reviewReceipt,reconcileReview,evidenceIdentity} from '@/lib/weekly-review-server';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const input=z.discriminatedUnion('intent',[
 z.object({intent:z.literal('generate'),id:z.string().uuid(),day:z.string().refine(validDay)}),
 z.object({intent:z.literal('viewed'),id:z.string().uuid()}),
 z.object({intent:z.literal('prepare'),id:z.string().uuid(),target:targetSchema}),
 z.object({intent:z.literal('feedback'),id:z.string().uuid(),feedback:z.enum(['not_now','does_not_fit','open'])})
]);
export async function GET(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in to open your weekly review.'},401);
 try{const accountId=(await accountScope(user,request)).id,recent=await recentReviews(accountId);
 return json({accountId,review:recent[0]?{...recent[0].review,receipt:recent[0].receipt}:null});
 }catch{return json({error:'Your review could not be loaded. Please retry.'},503)}
}
export async function POST(request:Request){
 const user=await getChatGPTUser(request);if(!user)return json({error:'Sign in to continue.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Open Weekly Review from Stride.'},403);
 try{
  const userId=(await accountScope(user,request)).id;if(request.headers.get('X-Stride-Account')!==userId)return json({error:'Your account changed. Reopen the review.'},403);
  const raw=await request.text();if(raw.length>10000)return json({error:'That request is too large.'},413);
  const parsed=input.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Please check the review request.'},400);
  const value=parsed.data,db=reviewDatabase();
  const row=await db.prepare('SELECT data,updated_at FROM user_training_data WHERE user_id=?').bind(userId).first<{data:string;updated_at:string}>();
  const data=row?migrateData(JSON.parse(row.data) as Data):initialData(),revision=row?.updated_at??null;
  if(value.intent==='generate'){
   const today=new Date().toISOString().slice(0,10);if(value.day<shiftDay(today,-1)||value.day>shiftDay(today,1))return json({error:'Review the current week using your local date.'},400);
   const key=await evidenceIdentity(userId,reviewBasis(data,value.day));
   const recent=await recentReviews(userId);
   for(const prior of recent)prior.review=await reconcileReview(userId,prior.review,data,value.day);
   const existing=await loadReview(userId,key.id);
   if(existing)return json({accountId:userId,review:await reconcileReview(userId,existing,data,value.day)});
   // Upgrade a legacy cached review once without reinterpreting unchanged account history.
   if(recent[0]&&!recent[0].review.basis&&recent[0].review.revision===revision){
    await db.prepare("UPDATE weekly_reviews SET content=json_set(content,'$.basis',?,'$.trigger',?) WHERE id=? AND user_id=?").bind(key.basis,'Based on your saved fitness history.',recent[0].review.id,userId).run();
    return json({accountId:userId,review:await loadReview(userId,recent[0].review.id)});
   }
   if(recent[0]?.review.basis===key.basis)return json({accountId:userId,review:recent[0].review});
   const analysis=analyzeWeek(data,value.day,recent);
   // Established evidence priorities and stable tie-breaking are sufficient here.
   // Overview never spends AI allowance or changes a recommendation on reload.
   const selected={recommendation:analysis.candidates[0],selection:'rules' as const};
   const previous=recent[0]?.review;
   if(previous&&previous.feedback!=='open'){
    const rec=selected.recommendation,old=previous.recommendation;
    const facts=(keys:string[],evidence:WeeklyReview['evidence'])=>JSON.stringify(evidence.filter(e=>keys.includes(e.key)).sort((a,b)=>a.key.localeCompare(b.key)));
    if(rec.key===old.key&&rec.kind===old.kind&&JSON.stringify(rec.target)===JSON.stringify(old.target)&&facts(rec.evidenceKeys,analysis.evidence)===facts(old.evidenceKeys,previous.evidence)){
     await db.prepare("UPDATE weekly_reviews SET content=json_set(content,'$.basis',?) WHERE id=? AND user_id=?").bind(key.basis,previous.id,userId).run();
     return json({accountId:userId,review:{...previous,basis:key.basis}});
    }
   }

   const trigger=recent[0]?.review.outcome&&['met','missed','mixed'].includes(recent[0].review.outcome.status)?'A comparable recorded workout is available to evaluate your previous focus.':recent[0]?.review.basis?'New or corrected fitness records are available.':'Based on your saved fitness history.';
   const review:WeeklyReview={id:key.id,basis:key.basis,trigger,lifecycle:'ready',createdAt:new Date().toISOString(),day:value.day,start:analysis.start,revision,summary:analysis.summary,standout:analysis.standout,coverage:analysis.coverage,observations:analysis.observations,keepDoing:analysis.keepDoing,evidence:analysis.evidence,prior:analysis.prior,...selected,feedback:'open'};
   // Review metadata never writes a fitness snapshot. Repeated request IDs return one durable review.
   const persisted=await db.prepare('INSERT OR IGNORE INTO weekly_reviews (id,user_id,created_at,content) SELECT ?,?,?,? WHERE (? IS NULL AND NOT EXISTS (SELECT 1 FROM user_training_data WHERE user_id=?)) OR EXISTS (SELECT 1 FROM user_training_data WHERE user_id=? AND updated_at=?)').bind(review.id,userId,review.createdAt,JSON.stringify(review),revision,userId,userId,revision).run();if(!persisted.meta.changes&&!await loadReview(userId,review.id))return json({error:'Your training changed while this review was being prepared. Review latest records again.'},409);
   const saved=await loadReview(userId,review.id);if(!saved)return json({error:'The review could not be retained. Retry.'},503);
   return json({accountId:userId,review:saved});
  }
  const review=await loadReview(userId,value.id);if(!review)return json({error:'This review is no longer available. Open a new review.'},404);
  if(value.intent==='viewed'){
   await db.prepare("UPDATE weekly_reviews SET content=json_set(content,'$.viewedAt',coalesce(json_extract(content,'$.viewedAt'),?)) WHERE id=? AND user_id=?").bind(new Date().toISOString(),review.id,userId).run();
   return json({accountId:userId,review:await reconcileReview(userId,(await loadReview(userId,review.id))!,data,new Date().toISOString().slice(0,10))});
  }
  if(value.intent==='feedback'){
   const result=await db.prepare("UPDATE weekly_reviews SET content=json_set(content,'$.feedback',?,'$.feedbackAt',?) WHERE id=? AND user_id=?").bind(value.feedback,new Date().toISOString(),value.id,userId).run();if(!result.meta.changes)return json({error:'Feedback could not be kept. Please retry.'},409);
   return json({accountId:userId,review:await reconcileReview(userId,(await loadReview(userId,value.id))!,data,new Date().toISOString().slice(0,10))});
  }
  if(review.prepared)return json({accountId:userId,review:{...review,receipt:await reviewReceipt(userId,review)}});
  const recommendation=review.recommendation;
  if(!recommendation.exerciseId||!recommendation.target)return json({error:'This recommendation does not need an account change.'},422);
  if(review.basis?(await evidenceIdentity(userId,reviewBasis(data,new Date().toISOString().slice(0,10)))).basis!==review.basis:revision!==review.revision)return json({error:'Your training changed since this review. Keep this review and refresh it before proposing a target.'},409);
  const exercise=data.exercises.find(e=>e.id===recommendation.exerciseId);if(!exercise)return json({error:'This exercise is no longer available.'},422);
  const next={...data,overrides:{...data.overrides,[exercise.id]:value.target}};
  const operation:Operation={id:review.id,action:'offer',expectedRevision:revision,payload:changes(data,next)};
  if(!operation.payload.length)return json({error:'This target is already current. No change is needed.'},422);
  validateOperation(data,next,operation);
  const prepared={operation,target:value.target};
  // Lock the first reviewed payload so edited/repeated requests cannot reuse an ID for another action.
  await db.prepare("UPDATE weekly_reviews SET content=json_set(content,'$.prepared',json(?),'$.proposedAt',?,'$.lifecycle','proposed') WHERE id=? AND user_id=? AND json_extract(content,'$.prepared') IS NULL").bind(JSON.stringify(prepared),new Date().toISOString(),review.id,userId).run();
  const saved=await loadReview(userId,review.id);if(!saved?.prepared)return json({error:'Your proposed change could not be retained. Retry.'},503);
  return json({accountId:userId,review:{...saved,receipt:await reviewReceipt(userId,saved)}});
 }catch{return json({error:'Your review needs attention. Nothing was silently changed; please retry.'},503)}
}
