import type {Data,Exercise,Workout,SetLog} from './training';
const attempted=(s:SetLog)=>['completed','modified','failed'].includes(s.status)&&Number.isFinite(s.weight)&&Number.isFinite(s.reps)&&s.reps>=0;
const passed=(s:SetLog)=>s.status!=='failed'&&s.difficulty!=='Failed'&&s.reps>=s.targetReps&&s.weight>=s.targetWeight;
const hard=(s:SetLog)=>['Hard','Very Hard','Failed'].includes(s.difficulty);
export function performanceHistory(d:Data,id:string){return d.workouts.filter(w=>w.completed).sort((a,b)=>b.date.localeCompare(a.date)).map(w=>({date:w.date,difficulty:w.difficulty,sets:w.entries.filter(e=>e.exerciseId===id).flatMap(e=>e.sets).filter(attempted)})).filter(w=>w.sets.length)}
export function adaptiveTarget(d:Data,e:Exercise){
 const h=performanceHistory(d,e.id),last=h[0],sets=last?.sets||[],step=e.increment>0?e.increment:5;
 const successful=sets.filter(s=>s.status!=='failed'&&s.reps>0),basis=successful.length?successful:sets;
 // Median actual working load avoids letting a single top set dictate every set.
 const median=(v:number[])=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
 let weight=basis.length?median(basis.map(s=>s.weight)):e.baseWeight,reps=basis.length?Math.max(1,median(basis.map(s=>s.reps))):e.baseReps,count=sets.length||e.baseSets,kind='Repeat',why='Choose a comfortable starting load. Your first sets establish your baseline.';
 const bad=(w:typeof last)=>w&&(w.difficulty==='Failed'||w.sets.filter(s=>!passed(s)).length/w.sets.length>=.5);
 const reduce=()=>{if(weight>0)weight=Math.max(0,Math.floor(weight*.9/step)*step);else reps=Math.max(1,reps-1)};
 if(last){
  const recent=h.slice(0,3),clean=sets.every(s=>passed(s)&&!hard(s))&&!['Hard','Very Hard','Failed'].includes(last.difficulty),repeatSuccess=clean&&h[1]&&h[1].sets.every(s=>passed(s)&&!hard(s))&&!['Hard','Very Hard','Failed'].includes(h[1].difficulty);
  if(Date.now()-new Date(last.date).getTime()>21*86400000){kind='Reduce';reduce();why='It has been over three weeks. Start lighter and use today’s effort to rebuild your targets.'}
  else if(bad(last)&&recent.length>=2&&bad(recent[1])){kind=recent.length===3&&bad(recent[2])?'Deload':'Reduce';reduce();if(kind==='Deload')count=Math.max(1,count-1);why='Repeated missed targets suggest backing off. Build consistent sets at this lighter target.'}
  else if(!clean){why='Stay with your recent working load. Missed reps or high effort call for consistency before adding more.'}
  else if(repeatSuccess||sets.every(s=>s.difficulty==='Easy')){kind='Increase';if(e.mode==='weight'&&weight>0&&step/weight<=.1)weight+=step;else if(e.mode==='volume')count=Math.min(20,count+1);else reps=Math.min(100,reps+1);why='Your recent sets were controlled and on target. Progress one step, then reassess how it feels.'}
  else why='Targets met. Repeat this working load once more to confirm it is sustainable before progressing.';
 }
 const override=d.overrides[e.id];
 return {weight:override?.weight??weight,reps:override?.reps??reps,sets:override?.sets??count,kind,why:override?'Using your chosen target. Adjust it whenever you need to.':why,overridden:!!override};
}
export function nextSetAdvice(d:Data,w:Workout,e:Exercise){
 const entry=w.entries.find(x=>x.exerciseId===e.id),logged=entry?.sets.filter(attempted)||[],next=entry?.sets.find(s=>s.status==='pending');
 if(w.completed||!logged.length||!next)return null;
 const last=logged.at(-1)!,step=e.increment>0?e.increment:5;
 let weight=last.weight,reps=Math.max(1,last.targetReps),reason='Good work. Keep the next set steady and aim for controlled reps.';
 if(!passed(last)||last.difficulty==='Very Hard'||last.difficulty==='Failed'){
  if(weight>0)weight=Math.max(0,Math.floor(weight*.9/step)*step);else reps=Math.max(1,Math.min(last.reps,last.targetReps)-1);
  reason='That set was a struggle. Take your rest, then reduce the target to keep the next set controlled.';
 }else if(last.difficulty==='Easy'){
  const history=performanceHistory(d,e.id),proven=history.some(h=>h.sets.some(s=>s.weight>=weight+step&&s.reps>=reps&&passed(s)));
  if(e.mode==='weight'&&weight>0&&step/weight<=.1&&(proven||logged.filter(s=>s.difficulty==='Easy'&&passed(s)).length>=2))weight+=step;else reps=Math.min(100,Math.max(last.reps,last.targetReps)+1);
  reason='You reported that set felt easy. Try a small step up and reassess; stop short of grinding reps.';
 }else if(hard(last)){reps=Math.max(1,Math.min(last.reps,last.targetReps));reason='That took effort. Hold the load, rest, and focus on matching clean reps rather than adding weight.'}
 const prior=logged.at(-2);if(prior&&last.weight===prior.weight&&last.reps<prior.reps*.8){if(weight>0)weight=Math.max(0,Math.floor(last.weight*.9/step)*step);else reps=Math.max(1,last.reps);reason='Reps dropped at the same load. Give yourself more rest and use a lighter next set.'}
 return {setId:next.id,weight,reps,reason,changed:weight!==next.targetWeight||reps!==next.targetReps};
}
export function coachingContext(d:Data){return {
 completedSessions:d.workouts.filter(w=>w.completed).length,
 exercises:d.exercises.map(e=>{const h=performanceHistory(d,e.id);return {id:e.id,name:e.name,increment:e.increment,mode:e.mode,sessions:h.length,totalAttemptedSets:h.reduce((n,w)=>n+w.sets.length,0),bestWeight:Math.max(0,...h.flatMap(w=>w.sets.filter(s=>s.status!=='failed').map(s=>s.weight))),recent:h.slice(0,4),target:adaptiveTarget(d,e)}}).filter(e=>e.sessions),
 goals:(d.goals||[]).filter(g=>!g.archived),bodyMeasurements:d.bodyMeasurements?.slice(-20),nutritionTargets:{calories:d.nutrition?.calorieTarget,protein:d.nutrition?.proteinTarget}
}}
