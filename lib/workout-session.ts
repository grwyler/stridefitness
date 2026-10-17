import {Workout,Template,Data,Exercise,Entry,SetLog,SetScheme,uid,setOf} from './training';
import {adaptRemainingTargets,defaultProgressionPolicy,recommendProgression} from './progression';

export function createEntryFromTemplate(data:Data,template:Template,planned:Template['entries'][number]):Entry{
 const exercise=data.exercises.find(item=>item.id===planned.exerciseId);
 if(!exercise)throw new Error(`Exercise ${planned.exerciseId} is missing from the saved library.`);
 const policy=planned.progressionPolicy||defaultProgressionPolicy(exercise),setScheme: SetScheme=planned.setScheme||'straight';
 const legacy=!planned.setScheme&&planned.repScheme?.length?planned.repScheme.map(reps=>({role:'unclassified' as const,countsTowardProgression:true,targetWeight:planned.weight,minReps:reps,maxReps:reps})):undefined;
 const base=planned.setPrescriptions?.length?planned.setPrescriptions:legacy;
 const context=`${template.id}:${template.revision||1}:${exercise.id}`;
 const result=recommendProgression(data,exercise,policy,base,context,{setScheme,repRange:planned.repRange,targetSets:planned.sets,plannedWeight:planned.weight});
 const previousWorkout=data.workouts.filter(workout=>workout.completed&&workout.templateId===template.id&&workout.entries.some(entry=>entry.exerciseId===exercise.id&&(entry.setScheme||'straight')===setScheme)).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const previousSets=previousWorkout?.entries.find(entry=>entry.exerciseId===exercise.id)?.sets||[];
 return {exerciseId:exercise.id,progressionPolicy:policy,setScheme,...(planned.repRange?{repRange:{...planned.repRange}}:{}),prescriptionVersion:template.revision||1,prescriptionContext:context,sets:result.prescription.map((prescription,index)=>{
  const set=setOf(prescription.targetWeight,prescription.minReps,prescription),previous=previousSets[index];
  return previous&&previous.status==='completed'?{...set,referencePerformance:{weight:previous.weight,reps:previous.reps,date:previousWorkout!.date}}:set;
 })};
}

export function createWorkoutFromTemplate(data:Data,template?:Template,name?:string,now=new Date()):Workout{
 return {id:uid(),name:name||template?.name||'New workout',...(template?{templateId:template.id}:{}),date:now.toISOString(),completed:false,difficulty:'Moderate',notes:'',entries:template?template.entries.map(entry=>createEntryFromTemplate(data,template,entry)):[]};
}

export function createExerciseEntry(data:Data,exercise:Exercise):Entry{
 const progressionPolicy=defaultProgressionPolicy(exercise),result=recommendProgression(data,exercise,progressionPolicy,undefined,undefined,{targetSets:exercise.baseSets,plannedWeight:exercise.baseWeight});
 return {exerciseId:exercise.id,progressionPolicy,setScheme:'straight',prescriptionVersion:1,sets:result.prescription.map(row=>setOf(row.targetWeight,row.minReps,row))};
}

export function logSetAndAdapt(entry:Entry,exercise:Exercise,setId:string,patch:Partial<SetLog>):Entry{
 let updated=entry.sets.map(set=>{
  if(set.id!==setId)return set;
  const manual=patch.manualTargetOverride===true;
  const next={...set,...patch,...(manual?{sessionPrescription:{...(set.sessionPrescription||set.prescription||{role:'working' as const,countsTowardProgression:true,targetWeight:set.targetWeight,minReps:Math.max(1,set.targetReps),maxReps:Math.max(1,set.targetReps)}),targetWeight:patch.targetWeight??set.targetWeight,minReps:patch.targetReps??set.targetReps,maxReps:patch.targetReps??set.targetReps}}:{})};
  return next;
 });
 if(patch.status&&patch.status!=='pending')updated=adaptRemainingTargets(exercise,updated,setId).sets;
 return {...entry,sets:updated};
}
