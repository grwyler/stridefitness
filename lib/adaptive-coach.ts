import type {Data,Exercise,Workout,SetLog} from './training';
import {recommendProgression,defaultProgressionPolicy} from './progression';
import {fitnessNow} from '@/lib/fitness-clock';

export function performanceHistory(d:Data,id:string){return d.workouts.filter(w=>w.completed).sort((a,b)=>b.date.localeCompare(a.date)).map(w=>({date:w.date,id:w.id,difficulty:w.difficulty,sets:w.entries.filter(e=>e.exerciseId===id).flatMap(e=>e.sets).filter(s=>['completed','modified','failed'].includes(s.status))})).filter(w=>w.sets.length);}
export function adaptiveTarget(d:Data,e:Exercise){const previous=d.workouts.filter(w=>w.completed&&w.entries.some(entry=>entry.exerciseId===e.id)).sort((a,b)=>b.date.localeCompare(a.date))[0]?.entries.find(entry=>entry.exerciseId===e.id);const result=recommendProgression(d,e,previous?.progressionPolicy||defaultProgressionPolicy(e),previous?.sets.map(set=>set.prescription).filter((row):row is NonNullable<typeof row>=>!!row),previous?.prescriptionContext);return {...result.target,...result,kind:result.kind,why:result.why};}

// Session-only adjustment: this may change remaining sets in this workout but never the reusable policy.
export function nextSetAdvice(_d:Data,w:Workout,e:Exercise){
 const entry=w.entries.find(x=>x.exerciseId===e.id),attempted=entry?.sets.filter(s=>['completed','modified','failed'].includes(s.status))||[],next=entry?.sets.find(s=>s.status==='pending');
 if(w.completed||!attempted.length||!next)return null;
 const last=attempted.at(-1)!,step=e.increment>0?e.increment:5;let weight=last.weight,reps=Math.max(1,last.reps),reason='Hold this load and focus on controlled reps for the remaining sets.';
 if(last.status==='failed'||last.difficulty==='Failed'){weight=Math.max(0,Math.floor((last.weight-step)/step)*step);reason='That set was missed. Use a lighter target for the remaining sets in this workout.';}
 else if(last.difficulty==='Easy'){if(e.mode==='weight'&&last.weight>0)weight=last.weight+step;else reps=Math.min(100,last.reps+1);reason='That set felt easy. You can try a small adjustment for the remaining sets today.';}
 else if(last.difficulty==='Very Hard'){reason='That set was demanding. Hold or reduce the remaining target for today.';}
 return {setId:next.id,weight,reps,reason,changed:weight!==next.targetWeight||reps!==next.targetReps,applyToRemaining:weight>next.targetWeight||(weight===next.targetWeight&&reps>next.targetReps)};
}
export function coachingContext(d:Data){return {completedSessions:d.workouts.filter(w=>w.completed).length,exercises:d.exercises.map(e=>{const result=adaptiveTarget(d,e),h=performanceHistory(d,e.id);return {id:e.id,name:e.name,increment:e.increment,mode:e.mode,sessions:h.length,totalAttemptedSets:h.reduce((n,w)=>n+w.sets.length,0),bestWeight:Math.max(0,...h.flatMap(w=>w.sets.filter(s=>s.status==='completed'||s.status==='modified').map(s=>s.weight))),recent:h.slice(0,4),progression:result,target:result.target}}).filter(e=>e.sessions),goals:(d.goals||[]).filter(g=>!g.archived),profile:d.profile,strengthProfile:d.strengthProfile,bodyMeasurements:d.bodyMeasurements?.slice(-20),nutritionTargets:{calories:d.nutrition?.calorieTarget,protein:d.nutrition?.proteinTarget}};}
