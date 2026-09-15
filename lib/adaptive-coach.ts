import {fitnessNow} from '@/lib/fitness-clock';
import type {Data,Exercise,Workout,SetLog} from './training';
const attempted=(s:SetLog)=>['completed','modified','failed'].includes(s.status)&&Number.isFinite(s.weight)&&Number.isFinite(s.reps)&&s.reps>=0;
const success=(s:SetLog)=>s.status!=='failed'&&s.difficulty!=='Failed'&&s.reps>0;
const hard=(s:SetLog)=>['Hard','Very Hard','Failed'].includes(s.difficulty);
const estimate=(weight:number,reps:number)=>weight>0?weight*(1+Math.max(0,reps)/30):Math.max(0,reps);
const score=(s:SetLog)=>estimate(s.weight,s.reps);
const targetScore=(s:SetLog)=>estimate(s.targetWeight,s.targetReps);
const roundTo=(value:number,step:number)=>Math.max(step,Math.round(value/step)*step);
const downTo=(value:number,step:number,percent=.925)=>Math.max(step,Math.floor(value*percent/step)*step);
const meaningfulDrop=(s:SetLog)=>targetScore(s)>0&&(score(s)<targetScore(s)*.88||(s.weight>=s.targetWeight*.97&&s.reps<s.targetReps*.8));
const metPerformance=(s:SetLog)=>success(s)&&(targetScore(s)<=0||score(s)>=targetScore(s)*.97);
const calibrationWeight=(e:Exercise)=>e.mode==='weight'&&/\b(barbell|bench press|back squat|deadlift|overhead press)\b/i.test(e.name)?45:e.baseWeight;
export function performanceHistory(d:Data,id:string){return d.workouts.filter(w=>w.completed).sort((a,b)=>b.date.localeCompare(a.date)).map(w=>({date:w.date,difficulty:w.difficulty,sets:w.entries.filter(e=>e.exerciseId===id).flatMap(e=>e.sets).filter(attempted)})).filter(w=>w.sets.length)}
function bestWorkingSet(sets:SetLog[]){
 const successful=sets.filter(success);if(!successful.length)return null;
 // Effort labels break ties only. Actual load and reps remain the primary evidence.
 return successful.reduce((best,set)=>score(set)>score(best)?set:best);
}
function increaseFrom(set:SetLog,e:Exercise){
 const step=e.increment>0?e.increment:5;
 if(e.mode==='volume')return {weight:set.weight,reps:set.reps};
 if(e.mode==='reps'||set.weight<=0)return {weight:set.weight,reps:Math.min(100,set.reps+1)};
 return {weight:roundTo(set.weight+step,step),reps:set.reps};
}
export function adaptiveTarget(d:Data,e:Exercise){
 const h=performanceHistory(d,e.id),last=h[0],sets=last?.sets||[],step=e.increment>0?e.increment:5,best=bestWorkingSet(sets),observed=best??sets.reduce<SetLog|null>((top,set)=>!top||score(set)>score(top)?set:top,null);
 let weight=observed?.weight??calibrationWeight(e),reps=Math.max(1,observed?.reps??e.baseReps),count=sets.filter(success).length||sets.length||e.baseSets,kind=h.length?'Repeat':'Baseline',why=weight>0?'Start with this conservative calibration load and adjust it to a comfortable working weight.':'Choose a comfortable starting load. Your first completed set will establish your baseline.';
 const troubled=(w:typeof last)=>!!w&&(w.difficulty==='Failed'||w.sets.filter(s=>s.status==='failed'||s.difficulty==='Failed'||meaningfulDrop(s)).length/Math.max(1,w.sets.length)>=.5);
 if(last&&observed){
  const recent=h.slice(0,3),allEasy=sets.filter(success).length>0&&sets.filter(success).every(s=>s.difficulty==='Easy')&&!['Hard','Very Hard','Failed'].includes(last.difficulty),clean=sets.filter(success).length>0&&!['Hard','Very Hard','Failed'].includes(last.difficulty)&&sets.every(s=>s.status==='skipped'||(metPerformance(s)&&!hard(s))),priorBest=h[1]&&bestWorkingSet(h[1].sets);
  if(fitnessNow().getTime()-new Date(last.date).getTime()>21*86400000){kind='Reduce';if(weight>0)weight=downTo(weight,step,.9);else reps=Math.max(1,reps-1);why='It has been over three weeks. Use a slightly lighter re-entry target, then recalibrate from what you complete.'}
  else if(troubled(last)&&recent.length>=2&&troubled(recent[1])){kind=recent.length===3&&troubled(recent[2])?'Deload':'Reduce';if(weight>0)weight=downTo(weight,step,.9);else reps=Math.max(1,reps-1);if(kind==='Deload')count=Math.max(1,count-1);why='Repeated failures or major performance drops support a temporary reduction. Build back with controlled sets.'}
  else if(allEasy&&best){kind='Increase';if(e.mode==='volume')count=Math.min(20,count+1);else ({weight,reps}=increaseFrom(best,e));why='Your best working sets felt easy. Add one small step while keeping the same clean technique.'}
  else if(clean&&best&&priorBest&&score(best)>=score(priorBest)*.97){kind='Increase';if(e.mode==='volume')count=Math.min(20,count+1);else ({weight,reps}=increaseFrom(best,e));why='You have confirmed this working level across sessions. Add one small step for progressive overload.'}
  else if(troubled(last)){kind='Repeat';why='One difficult session is not enough to cut the load. Repeat your strongest controlled set after adequate rest and reassess.'}
  else if(best&&(best.weight!==best.targetWeight||best.reps!==best.targetReps)){why='Your completed set outperformed the prior target. Use it as the new working baseline before adding another step.'}
  else if(best&&(best.difficulty==='Hard'||best.difficulty==='Very Hard')){why='That load was productive but demanding. Hold it until the reps are controlled before progressing.'}
  else why='Your strongest controlled set is the best next target. Repeat it once to confirm, then progress.';
 }
 const override=d.overrides[e.id];
 return {weight:override?.weight??weight,reps:override?.reps??reps,sets:override?.sets??Math.max(1,count),kind,why:override?'Using your chosen target. Adjust it whenever you need to.':why,overridden:!!override,calibrating:!h.length};
}
export function nextSetAdvice(d:Data,w:Workout,e:Exercise){
 const entry=w.entries.find(x=>x.exerciseId===e.id),logged=entry?.sets.filter(attempted)||[],next=entry?.sets.find(s=>s.status==='pending');
 if(w.completed||!logged.length||!next)return null;
 const last=logged.at(-1)!,step=e.increment>0?e.increment:5,prior=logged.at(-2),actualBeatTarget=targetScore(last)>0&&score(last)>targetScore(last)*1.03;
 let weight=last.weight,reps=Math.max(1,last.reps),reason='Good set. Hold this load and repeat the reps with the same control.';
 if(last.status==='failed'||last.difficulty==='Failed'){
  if(last.weight>0)weight=downTo(last.weight,step,.9);else reps=Math.max(1,last.reps-1);
  reason='That set failed. Reduce one controlled step for the next set and keep clean reps.';
 }else if(prior&&last.weight===prior.weight&&last.reps<prior.reps*.8){
  if(last.weight>0)weight=downTo(last.weight,step,.925);else reps=Math.max(1,last.reps);
  reason='Performance dropped sharply at the same load. Rest fully, then use a small back-off set.';
 }else if(last.difficulty==='Very Hard'&&meaningfulDrop(last)){
  if(last.weight>0)weight=downTo(last.weight,step,.95);else reps=Math.max(1,last.reps-1);
  reason='That set was very hard and performance dropped well below the target. Use a small back-off set.';
 }else if(last.difficulty==='Easy'){
  ({weight,reps}=increaseFrom(last,e));
  reason=logged.length===1&&!performanceHistory(d,e.id).length?'That first set was easy, so treat it as calibration. Add one small load step and reassess.':'That set was easy. Add one small step while keeping the same clean technique.';
 }else if(actualBeatTarget){
  reason='That stronger completed set establishes a better working target. Hold it for the next set and confirm it with clean reps.';
 }else if(last.difficulty==='Hard'||last.difficulty==='Very Hard'){
  reason='That was demanding but completed. Hold the load after a full rest; reduce only if performance drops or the next set fails.';
 }
 const changed=weight!==next.targetWeight||reps!==next.targetReps;
 const applyToRemaining=changed&&(weight>next.targetWeight||(weight===next.targetWeight&&reps>next.targetReps));
 return {setId:next.id,weight,reps,reason,changed,applyToRemaining};
}
export function coachingContext(d:Data){return {
 completedSessions:d.workouts.filter(w=>w.completed).length,
 exercises:d.exercises.map(e=>{const h=performanceHistory(d,e.id);return {id:e.id,name:e.name,increment:e.increment,mode:e.mode,sessions:h.length,totalAttemptedSets:h.reduce((n,w)=>n+w.sets.length,0),bestWeight:Math.max(0,...h.flatMap(w=>w.sets.filter(success).map(s=>s.weight))),recent:h.slice(0,4),target:adaptiveTarget(d,e)}}).filter(e=>e.sessions),
 goals:(d.goals||[]).filter(g=>!g.archived),bodyMeasurements:d.bodyMeasurements?.slice(-20),nutritionTargets:{calories:d.nutrition?.calorieTarget,protein:d.nutrition?.proteinTarget}
};}
