import {z} from 'zod';
import type {Data} from './training';
import {planSchema} from './plan';
import {coachingUpdatesSchema} from './coaching-updates';
import {profileSchema} from './profile';
import {muscleGroups} from './muscle-recovery';
import {validMeasurement} from './body-measurements';

export type Patch={path:string[];before?:unknown;after?:unknown};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
const keyed=(v:any)=>Array.isArray(v)&&v.every(x=>object(x)&&typeof (x.id??x.exerciseId)==='string');
const key=(v:any)=>v.id??v.exerciseId;
// Record-aware three-way changes: unrelated fields and records never enter a write.
export function changes(before:any,after:any,path:string[]=[]):Patch[]{
 if(equal(before,after))return [];
 if(keyed(before)&&keyed(after)){
  const ids=new Set([...before.map(key),...after.map(key)]);
  return [...ids].flatMap(id=>changes(before.find((v:any)=>key(v)===id),after.find((v:any)=>key(v)===id),[...path,'@'+id]));
 }
 if(object(before)&&object(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>changes(before[k],after[k],[...path,k]));
 return [{path,...(before!==undefined?{before}:{}),...(after!==undefined?{after}:{})}];
}
export function applyChanges<T>(current:T,patches:Patch[]):T{
 const result=structuredClone(current) as any;
 for(const p of patches){
  if(!p.path.length||p.path.some(x=>['__proto__','prototype','constructor'].includes(x)))throw new Error('Invalid change path.');
  let parent=result;
  for(const part of p.path.slice(0,-1)){
   parent=part.startsWith('@')?Array.isArray(parent)?parent.find((v:any)=>key(v)===part.slice(1)):undefined:parent?.[part];
   if(parent===undefined||parent===null)throw new Error('A target changed. Review the current data before reapplying.');
  }
  const last=p.path.at(-1)!;
  const index=last.startsWith('@')&&Array.isArray(parent)?parent.findIndex((v:any)=>key(v)===last.slice(1)):null;
  const old=index!==null?(index<0?undefined:parent[index]):parent[last];
  if(equal(old,p.after))continue;
  if(!equal(old,p.before))throw new Error('The same information was edited elsewhere. Keep the current data or request an updated coach suggestion.');
  if(index!==null){if(p.after===undefined){if(index>=0)parent.splice(index,1)}else if(index<0)parent.push(structuredClone(p.after));else parent[index]=structuredClone(p.after)}
  else if(p.after===undefined)delete parent[last];else parent[last]=structuredClone(p.after);
 }
 return result;
}
export const operationSchema=z.object({id:z.string().uuid(),action:z.enum(['plan','template','session','exercise','progress','offer','set']),payload:z.array(z.object({path:z.array(z.string().min(1).max(200)).min(1).max(12),before:z.unknown().optional(),after:z.unknown().optional()})).min(1).max(2000),expectedRevision:z.string().nullable()});
export type Operation=z.infer<typeof operationSchema>;
export type Receipt={id:string;action:Operation['action'];revision:string;committedAt:string;targets:string[]};
export type PendingOperation=Operation&{label:string;status:'Proposed'|'Saving'|'Saved to your account'|'Needs attention';error?:string;receipt?:Receipt;submitted?:boolean};
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),num=(min:number,max:number)=>z.number().finite().min(min).max(max);
const exercise=z.object({id,name:z.string().min(1).max(100),category:z.string().min(1).max(100),mode:z.enum(['weight','reps','volume']),increment:num(0,1000),baseWeight:num(0,2000),baseReps:num(1,100).int(),baseSets:num(1,20).int()}).passthrough();
const set=z.object({id,weight:num(0,2000),reps:num(0,100).int(),targetWeight:num(0,2000),targetReps:num(0,100).int(),status:z.enum(['pending','completed','failed','skipped','modified']),difficulty:z.string(),notes:z.string()}).passthrough();
const template=z.object({id,name:z.string().min(1).max(100),description:z.string(),entries:z.array(z.object({exerciseId:id,weight:num(0,2000),reps:num(1,100).int(),sets:num(1,20).int()})).min(1).max(20)}).passthrough();
const workout=z.object({id,name:z.string().min(1).max(100),date:z.string(),completed:z.boolean(),difficulty:z.string(),notes:z.string(),entries:z.array(z.object({exerciseId:id,sets:z.array(set).max(100)})).max(100)}).passthrough();
const goal=z.object({id,title:z.string().min(1).max(100),kind:z.enum(['measurement','daily','sessions','strength','compound','milestone']),unit:z.string().min(1).max(20),start:z.number().finite(),target:z.number().finite(),started:z.string(),deadline:z.string(),archived:z.boolean(),exerciseId:id.optional(),measurementMetric:z.enum(['weight','bodyFat']).optional(),dailyMetric:z.enum(['hydration','activeCalories','protein','calorieIntake']).optional(),checks:z.array(z.object({id,date:z.string(),value:z.number().finite(),note:z.string()}))}).passthrough();
const activity=z.object({id,name:z.string().min(1).max(80),description:z.string().max(200),durationMinutes:num(5,720).int(),intensity:z.enum(['Light','Moderate','Vigorous']),met:num(1.5,18),scheduleHint:z.string().max(80)}).passthrough();
const nutrition=z.object({calorieTarget:num(800,10000).int().nullable(),proteinTarget:num(20,1000).int().nullable(),activityCalorieAdjustment:z.union([z.literal(0),z.literal(50),z.literal(100)]).optional(),entries:z.array(z.unknown())}).passthrough();
const measurement=z.object({id,date:z.string(),weight:num(50,1500).nullable(),bodyFat:num(1,75).nullable()});
const allowed:Record<Operation['action'],string[]>={plan:['templates','coachPlanner'],template:['templates'],session:['workouts'],set:['workouts'],exercise:['exercises'],progress:['goals','nutrition','activityEnergy','recoveryOverrides'],offer:['goals','nutrition','profile','bodyMeasurements','strengthProfile','coachOffers','overrides']};
export function validateOperation(before:Data,next:Data,op:Operation){
 for(const patch of op.payload)if(!allowed[op.action].includes(patch.path[0]))throw new Error('This coach action cannot change that information.');
 function unique(rows:any[]){const ids=rows.map(key);if(new Set(ids).size!==ids.length)throw new Error('Repeated record IDs are not allowed.');ids.forEach(v=>id.parse(v))}
 const catalog=new Set(next.exercises.map(e=>e.id));
 for(const field of ['exercises','templates','workouts','goals','bodyMeasurements'] as const){
  const rows=next[field]||[];unique(rows);
  for(const row of rows){const previous=(before[field] as any[]|undefined)?.find(x=>x.id===row.id);if(equal(previous,row))continue;
   ({exercises:exercise,templates:template,workouts:workout,goals:goal,bodyMeasurements:measurement}[field]).parse(row);
   if('entries' in row){unique(row.entries);for(const entry of row.entries){if(!catalog.has(entry.exerciseId))throw new Error('An exercise is no longer available.');if(Array.isArray(entry.sets))unique(entry.sets)}}
   if('kind' in row&&row.kind==='strength'&&!catalog.has(row.exerciseId||''))throw new Error('Choose an existing exercise for this strength goal.');
   if(field==='bodyMeasurements'){const m=row as Data['bodyMeasurements'] extends (infer T)[]|undefined?T:never;if(!validMeasurement(m.date,m.weight,m.bodyFat,new Date(Date.now()+86400000).toISOString().slice(0,10)))throw new Error('Invalid measurement date or value.')}
  }
 }
 if(!equal(before.overrides,next.overrides)){z.record(z.object({weight:num(0,2000),reps:num(1,100).int(),sets:num(1,20).int()})).parse(next.overrides);for(const exerciseId of Object.keys(next.overrides))if(!catalog.has(exerciseId))throw new Error('Choose an existing exercise for this target.');}
 if(!equal(before.strengthProfile,next.strengthProfile))z.object({bodyweight:num(50,1500).nullable(),comparison:z.enum(['general','men','women']),heightInches:num(36,96).nullable().optional(),recoveryFigure:z.enum(['masculine','neutral','feminine']).optional()}).parse(next.strengthProfile);
 if(!equal(before.coachPlanner,next.coachPlanner)){const planner=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string()})).max(200),plan:planSchema.nullable(),ids:z.array(id),draft:z.boolean().optional()}).parse(next.coachPlanner);if(planner.ids.some(id=>!next.templates.some(t=>t.id===id)))throw new Error('The plan points to an unavailable template.')}
 if(!equal(before.coachOffers,next.coachOffers))z.record(coachingUpdatesSchema).parse(next.coachOffers);
 if(!equal(before.exercises,next.exercises)){for(const w of [...next.workouts,...next.templates])for(const e of w.entries)if(!catalog.has(e.exerciseId))throw new Error('An exercise referenced by a workout cannot be removed.');}
 if(!equal(before.nutrition,next.nutrition))nutrition.parse(next.nutrition);
 if(!equal(before.recoveryOverrides,next.recoveryOverrides))z.array(z.object({group:z.enum(muscleGroups),reportedAt:z.string().datetime()})).max(muscleGroups.length).parse(next.recoveryOverrides||[]);
 if(!equal(before.profile,next.profile))profileSchema.parse(next.profile);
 if(!equal(before.activityEnergy,next.activityEnergy)){if(!next.activityEnergy||!Array.isArray(next.activityEnergy.logs))throw new Error('Invalid activity structure.');unique(next.activityEnergy.templates);for(const row of next.activityEnergy.templates)activity.parse(row);if(!equal(before.activityEnergy?.logs||[],next.activityEnergy.logs))throw new Error('Reusable activity changes cannot edit activity history.')}
 if(!equal(before.nutrition?.entries||[],next.nutrition?.entries||[]))throw new Error('Nutrition target changes cannot edit food history.');
 // Protect every already logged set, including failed and modified attempts.
 for(const w of before.workouts)for(const entry of w.entries)for(const logged of entry.sets.filter(s=>s.status!=='pending')){
  const found=next.workouts.find(x=>x.id===w.id)?.entries.find(x=>x.exerciseId===entry.exerciseId)?.sets.find(s=>s.id===logged.id);
  if(!equal(logged,found))throw new Error('Logged sets must remain intact. Ask for changes to remaining sets only.');
 }
}
