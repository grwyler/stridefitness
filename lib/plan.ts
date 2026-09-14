import {coachingUpdatesSchema} from './coaching-updates';
import {nutritionTotals,localDay} from './nutrition';
import {emptyNutrition} from './nutrition';
import {Goal,compoundTotal,estimatedStrength,goalProgress} from './goals';
import {z} from 'zod';
import {Data,Template,recommend,uid} from './training';
export const planSchema=z.object({saveUpdates:coachingUpdatesSchema.optional().default(null),
 message:z.string().min(1).max(3000),
 workouts:z.array(z.object({name:z.string().min(1).max(100),description:z.string().max(1500),entries:z.array(z.object({exerciseId:z.string().min(1).max(100),sets:z.number().int().min(1).max(20),reps:z.number().int().min(1).max(100),weight:z.number().min(0).max(2000).nullable()})).min(1).max(20)})).max(14),
 progress:z.object({
  goal:z.object({title:z.string().min(1).max(100),kind:z.enum(['measurement','sessions','strength','compound','milestone']),unit:z.string().min(1).max(20),start:z.number(),target:z.number(),deadline:z.string().max(20).nullable(),exerciseId:z.string().max(100).nullable()}).nullable(),
  nutrition:z.object({calorieTarget:z.number().int().min(800).max(10000).nullable(),proteinTarget:z.number().int().min(20).max(1000).nullable()}).nullable()
 }).nullable().default(null)
});
export type GeneratedPlan=z.infer<typeof planSchema>;
export type ProgressProposal=NonNullable<GeneratedPlan['progress']>;
export type PlanMessage={role:'user'|'assistant';content:string;photo?:string};
export function applyPlan(data:Data,plan:GeneratedPlan,replaceIds:string[]=[]):{data:Data;ids:string[]}{
 const validated=planSchema.parse(plan);
 if(!validated.workouts.length)return {data,ids:replaceIds};
 const templates:Template[]=validated.workouts.map(w=>{
  const seen=new Set<string>();
  return {id:uid(),name:w.name,description:w.description,entries:w.entries.map(x=>{
   const exercise=data.exercises.find(e=>e.id===x.exerciseId);
   if(!exercise||seen.has(x.exerciseId))throw new Error('The plan contains an unavailable or repeated exercise. Please try again.');
   seen.add(x.exerciseId);
   return {...x,weight:x.weight??recommend(data,exercise).weight};
  })};
 });
 return {data:{...data,templates:[...data.templates.filter(t=>!replaceIds.includes(t.id)),...templates]},ids:templates.map(t=>t.id)};
}

export function applyProgressProposal(data:Data,proposal:ProgressProposal):Data{
 let next=data;
 if(proposal.goal){
  const g=proposal.goal,today=new Date().toLocaleDateString('en-CA');
  const start=g.kind==='strength'?estimatedStrength(data,g.exerciseId||undefined):g.kind==='compound'?compoundTotal(data):g.kind==='sessions'||g.kind==='milestone'?0:g.start;
  const goal:Goal={id:uid(),title:g.title,kind:g.kind,unit:g.unit,start,target:g.target,started:today,deadline:g.deadline||'',archived:false,checks:[],...(g.exerciseId?{exerciseId:g.exerciseId}:{})};
  next={...next,goals:[...(next.goals||[]),goal]};
 }
 if(proposal.nutrition)next={...next,nutrition:{...(next.nutrition||emptyNutrition()),calorieTarget:proposal.nutrition.calorieTarget,proteinTarget:proposal.nutrition.proteinTarget}};
 return next;
}

export function coachingContext(data:Data){
 const completed=data.workouts.filter(w=>w.completed).sort((a,b)=>b.date.localeCompare(a.date));
 const seen=new Set<string>();
 const recent=[];
 for(const w of completed.slice(0,4))for(const entry of w.entries){
  if(seen.has(entry.exerciseId)||recent.length>=8)continue;
  seen.add(entry.exerciseId);
  const attempted=entry.sets.filter(s=>s.status==='completed'||s.status==='modified'||s.status==='failed');
  const successful=attempted.find(s=>s.status!=='failed');
  recent.push({exerciseId:entry.exerciseId,date:w.date,weight:successful?.weight??null,reps:successful?.reps??null,completedSets:attempted.filter(s=>s.status!=='failed').length,failedSets:attempted.filter(s=>s.status==='failed').length,difficulty:w.difficulty});
 }
 return {nutrition:data.nutrition?{date:localDay(),calorieTarget:data.nutrition.calorieTarget,proteinTarget:data.nutrition.proteinTarget,...nutritionTotals(data.nutrition.entries,localDay())}:undefined,completedSessions:completed.length,recent,goals:(data.goals||[]).filter(g=>!g.archived).slice(0,10).map(g=>({title:g.title,kind:g.kind,exerciseId:g.exerciseId,unit:g.unit,start:g.start,target:g.target,current:goalProgress(g,data).current,deadline:g.deadline}))};
}
