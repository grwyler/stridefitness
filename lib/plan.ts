import {nutritionTotals,localDay} from './nutrition';
import {goalProgress} from './goals';
import {z} from 'zod';
import {Data,Template,recommend,uid} from './training';
export const planSchema=z.object({
 message:z.string().min(1).max(3000),
 workouts:z.array(z.object({name:z.string().min(1).max(100),description:z.string().max(1500),entries:z.array(z.object({exerciseId:z.string().min(1).max(100),sets:z.number().int().min(1).max(20),reps:z.number().int().min(1).max(100),weight:z.number().min(0).max(2000).nullable()})).min(1).max(20)})).max(14)
});
export type GeneratedPlan=z.infer<typeof planSchema>;
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
 return {nutrition:data.nutrition?{date:localDay(),calorieTarget:data.nutrition.calorieTarget,proteinTarget:data.nutrition.proteinTarget,...nutritionTotals(data.nutrition.entries,localDay())}:undefined,completedSessions:completed.length,recent,goals:(data.goals||[]).filter(g=>!g.archived).slice(0,10).map(g=>({title:g.title,kind:g.kind,unit:g.unit,start:g.start,target:g.target,current:goalProgress(g,data).current,deadline:g.deadline}))};
}
