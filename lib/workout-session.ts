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

export function changeActiveExerciseScheme(data:Data,workout:Workout,exerciseId:string,setScheme:SetScheme,at=new Date().toISOString()):{workout:Workout;changed:boolean;reason?:string}{
 const entry=workout.entries.find(item=>item.exerciseId===exerciseId),exercise=data.exercises.find(item=>item.id===exerciseId);
 if(!entry||!exercise)return {workout,changed:false,reason:'Exercise is unavailable.'};
 const currentScheme=entry.setScheme||'straight';if(currentScheme===setScheme)return {workout,changed:false};
 const pending=entry.sets.filter(set=>set.status==='pending');
 if(pending.some(set=>set.tierActuals?.some(tier=>tier.status!=='pending')))return {workout,changed:false,reason:'Finish or reset the current extended set before changing schemes.'};
 const mutable=pending.filter(set=>!set.manualTargetOverride),template=workout.templateId?data.templates.find(item=>item.id===workout.templateId):undefined,planned=template?.entries.find(item=>item.exerciseId===exerciseId);
 const firstTarget=mutable[0]?.sessionPrescription||mutable[0]?.prescription;
 const result=mutable.length?recommendProgression(data,exercise,entry.progressionPolicy||planned?.progressionPolicy||defaultProgressionPolicy(exercise),undefined,entry.prescriptionContext,{setScheme,repRange:entry.repRange||planned?.repRange,targetSets:mutable.length,plannedWeight:firstTarget?.targetWeight??planned?.weight??exercise.baseWeight}):undefined;
 const changedTargets:{setId:string;previous:NonNullable<SetLog['prescription']>;adapted:NonNullable<SetLog['prescription']>}[]=[];
 let nextIndex=0;
 const sets=entry.sets.map(set=>{
  if(set.status!=='pending'||set.manualTargetOverride)return set;
  const adapted=result!.prescription[nextIndex++],previous=set.sessionPrescription||set.prescription||{role:'working' as const,countsTowardProgression:true,targetWeight:set.targetWeight,minReps:Math.max(1,set.targetReps),maxReps:Math.max(1,set.targetReps)};
  changedTargets.push({setId:set.id,previous:{...previous},adapted:{...adapted}});
  const tierActuals=adapted.tiers?.map(tier=>{const old=set.tierActuals?.find(item=>item.order===tier.order);return {...(old||{order:tier.order,targetWeight:tier.targetWeight,targetMinReps:tier.minReps,targetMaxReps:tier.maxReps,status:'pending' as const}),order:tier.order,targetWeight:tier.targetWeight,targetMinReps:tier.minReps,targetMaxReps:tier.maxReps,status:'pending' as const,...(old?.entryEdited?{actualWeight:old.actualWeight,actualReps:old.actualReps,entryEdited:true}:{actualWeight:undefined,actualReps:undefined,entryEdited:false})};});
  return {...set,targetWeight:adapted.targetWeight,targetReps:adapted.minReps,...(set.actualEntryEdited?{}:{weight:adapted.targetWeight,reps:adapted.minReps}),sessionPrescription:adapted,...(adapted.tiers?{tierActuals}: {tierActuals:undefined}),adaptationReason:"Targets regenerated for today's scheme"};
 });
 const updatedEntry={...entry,setScheme,originalSetScheme:entry.originalSetScheme||currentScheme,sessionSchemeChanges:[...(entry.sessionSchemeChanges||[]),{from:currentScheme,to:setScheme,at,sets:changedTargets.map(item=>({setId:item.setId,previous:item.previous,adapted:item.adapted}))}],sets};
 return {workout:{...workout,entries:workout.entries.map(item=>item===entry?updatedEntry:item)},changed:true};
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
