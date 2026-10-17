import type {Data,Exercise,Workout,SetLog} from './training';
import {recommendProgression,defaultProgressionPolicy} from './progression';
import {fitnessNow} from '@/lib/fitness-clock';

export function performanceHistory(d:Data,id:string){return d.workouts.filter(w=>w.completed).sort((a,b)=>b.date.localeCompare(a.date)).map(w=>({date:w.date,id:w.id,difficulty:w.difficulty,sets:w.entries.filter(e=>e.exerciseId===id).flatMap(e=>e.sets).filter(s=>['completed','modified','failed'].includes(s.status))})).filter(w=>w.sets.length);}
export function adaptiveTarget(d:Data,e:Exercise){
 const latest=d.workouts.filter(w=>w.completed&&w.entries.some(entry=>entry.exerciseId===e.id)).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const previous=latest?.entries.find(entry=>entry.exerciseId===e.id);
 const template=latest?.templateId?d.templates.find(item=>item.id===latest.templateId):undefined;
 const planned=template?.entries.find(entry=>entry.exerciseId===e.id);
 const setScheme=planned?.setScheme||previous?.setScheme||'straight';
 const base=planned?.setPrescriptions?.length?planned.setPrescriptions:previous?.sets.map(set=>set.prescription).filter((row):row is NonNullable<typeof row>=>!!row);
 const context=template?`${template.id}:${template.revision||1}:${e.id}`:previous?.prescriptionContext;
 const result=recommendProgression(d,e,planned?.progressionPolicy||previous?.progressionPolicy||defaultProgressionPolicy(e),base,context,{setScheme,repRange:planned?.repRange,targetSets:planned?.sets,plannedWeight:planned?.weight});
 return {...result.target,...result,kind:result.kind,why:result.why};
}

export function coachingContext(d:Data){return {completedSessions:d.workouts.filter(w=>w.completed).length,exercises:d.exercises.map(e=>{const result=adaptiveTarget(d,e),h=performanceHistory(d,e.id);return {id:e.id,name:e.name,increment:e.increment,loadAvailability:e.loadAvailability,mode:e.mode,sessions:h.length,totalAttemptedSets:h.reduce((n,w)=>n+w.sets.length,0),bestWeight:Math.max(0,...h.flatMap(w=>w.sets.filter(s=>s.status==='completed'||s.status==='modified').map(s=>s.weight))),recent:h.slice(0,4),progression:result,target:result.target}}).filter(e=>e.sessions),goals:(d.goals||[]).filter(g=>!g.archived),profile:d.profile,strengthProfile:d.strengthProfile,bodyMeasurements:d.bodyMeasurements?.slice(-20),nutritionTargets:{calories:d.nutrition?.calorieTarget,protein:d.nutrition?.proteinTarget}};}
