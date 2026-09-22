import {Workout,setOf} from './training';
import type {SessionCoachReply} from './session-coach';

export function applySessionChanges(workout:Workout,changes:SessionCoachReply['changes'],catalog:string[]){
 let next=workout,applied=0,skipped=0;
 if(workout.completed)return {workout,applied,skipped:changes.length};
 for(const change of changes){
  if(change.type==='rename_workout'){
   if(change.name&&change.name!==next.name){next={...next,name:change.name};applied++}else skipped++;
   continue;
  }
  if(!catalog.includes(change.exerciseId)){skipped++;continue}
  if(change.type==='add_exercise'){
   if(next.entries.some(e=>e.exerciseId===change.exerciseId)){skipped++;continue}
   next={...next,entries:[...next.entries,{exerciseId:change.exerciseId,sets:Array.from({length:change.sets??3},()=>setOf(change.weight??0,change.reps??8))}]};applied++;continue;
  }
  const index=next.entries.findIndex(e=>e.exerciseId===change.exerciseId),entry=next.entries[index];
  const pending=entry?.sets.filter(s=>s.status==='pending')??[];
  if(!entry||!pending.length){skipped++;continue}
  const logged=entry.sets.filter(s=>s.status!=='pending');
  const entries=[...next.entries];
  if(change.type==='remove_exercise')entries.splice(index,1,...(logged.length?[{...entry,sets:logged}]:[]));
  else if(change.type==='replace_exercise'){
   const replacement=change.replacementExerciseId;
   if(!replacement||replacement===entry.exerciseId||!catalog.includes(replacement)){skipped++;continue}
   const sets=Array.from({length:change.sets??pending.length},(_,i)=>setOf(change.weight??0,change.reps??pending[i]?.reps??pending[0].reps));
   entries.splice(index,1,...(logged.length?[{...entry,sets:logged}]:[]));
   const existing=entries.findIndex(e=>e.exerciseId===replacement);
   if(existing>=0)entries[existing]={...entries[existing],sets:[...entries[existing].sets,...sets]};
   else entries.splice(index+(logged.length?1:0),0,{exerciseId:replacement,sets});
  }else{
   if(change.sets===null&&change.reps===null&&change.weight===null){skipped++;continue}
   const sets=Array.from({length:change.sets??pending.length},(_,i)=>{
    const old=pending[i]??setOf(pending[0].weight,pending[0].reps);
    return {...old,weight:change.weight??old.weight,targetWeight:change.weight??old.targetWeight,reps:change.reps??old.reps,targetReps:change.reps??old.targetReps};
   });
   entries[index]={...entry,sets:[...logged,...sets]};
   if(JSON.stringify(entries[index])===JSON.stringify(entry)){skipped++;continue}
  }
  next={...next,entries};applied++;
 }
 return {workout:next,applied,skipped};
}
