import type {Data,Exercise,LoadAvailability,ProgressionPolicy,SetLog,SetPrescription,SetScheme,Target,Workout} from './training';
import {defaultRepRange,resolveExerciseProgrammingProfile} from './exercise-programming-profile';

export type ProgressionReasonCode='baseline'|'fixed_prescription'|'manual_override'|'no_progression_sets'|'insufficient_history'|'mixed_performance'|'missed_minimum'|'repeated_underperformance'|'confirmed_progress'|'rep_progress'|'equipment_limited'|'session_adjustment'|'long_gap';
export type ProgressionEvidence={kind:'success'|'miss'|'effort'|'insufficient'|'load'|'reps'|'equipment'|'role'|'manual'|'modified'|'history';workoutId?:string;setId?:string;detail:string};
export type ProgressionResult={target:Target;prescription:SetPrescription[];kind:'Baseline'|'Repeat'|'Increase'|'Hold'|'Reduce';reasonCode:ProgressionReasonCode;why:string;evidence:ProgressionEvidence[];overridden:boolean;calibrating:boolean};
export type LoadChoice={load:number|null;reason:'available'|'no_higher_load'|'jump_too_large'|'bodyweight'|'no_lower_load'};

const HISTORY_GAP_DAYS=42;
export type PrescriptionOptions={setScheme?:SetScheme;repRange?:{min:number;max:number};targetSets?:number;plannedWeight?:number};
const round=(n:number)=>Number(Math.max(0,n).toFixed(6));
const stepFor=(e:Exercise)=>e.loadAvailability?.kind==='increment'&&e.loadAvailability.step>0?e.loadAvailability.step:e.increment>0?e.increment:5;
export function nextValidLoad(exercise:Exercise,current:number):LoadChoice{
 const model=exercise.loadAvailability;
 if(model?.kind==='bodyweight')return {load:null,reason:'bodyweight'};
 if(model?.kind==='discrete'){
  const values=[...new Set(model.values.filter(x=>Number.isFinite(x)&&x>=0))].sort((a,b)=>a-b),next=values.find(x=>x>current+1e-6);
  if(next===undefined)return {load:null,reason:'no_higher_load'};
  return model.maxJump!==undefined&&model.maxJump>0&&next-current>model.maxJump+1e-6?{load:null,reason:'jump_too_large'}:{load:next,reason:'available'};
 }
 const step=stepFor(exercise),candidate=round((Math.floor((current+1e-6)/step)+1)*step);
 return candidate>current+1e-6?{load:candidate,reason:'available'}:{load:null,reason:'no_higher_load'};
}
export function previousValidLoad(exercise:Exercise,current:number):LoadChoice{
 const model=exercise.loadAvailability;
 if(model?.kind==='bodyweight')return {load:null,reason:'bodyweight'};
 if(model?.kind==='discrete'){
  const values=[...new Set(model.values.filter(x=>Number.isFinite(x)&&x>=0))].sort((a,b)=>a-b),previous=values.filter(x=>x<current-1e-6).at(-1);
  return previous===undefined?{load:null,reason:'no_lower_load'}:{load:previous,reason:'available'};
 }
 const step=stepFor(exercise),candidate=round(Math.max(0,Math.ceil((current-1e-6)/step)-1)*step);
 return candidate<current-1e-6?{load:candidate,reason:'available'}:{load:null,reason:'no_lower_load'};
}

export const defaultProgressionPolicy=(exercise:Exercise):ProgressionPolicy=>({kind:'rep_range',scope:'group',advanceBy:exercise.mode==='volume'?'sets':exercise.mode==='reps'||resolveExerciseProgrammingProfile(exercise).progressionBias==='reps'?'reps':'auto',successSessions:2,failureAction:'hold'});
const zeroLoadValid=(exercise:Exercise)=>exercise.mode==='reps'||exercise.loadAvailability?.kind==='bodyweight';
const usableLoad=(exercise:Exercise,value:number|undefined|null)=>Number.isFinite(value)&&(zeroLoadValid(exercise)?(value as number)>=0:(value as number)>0);
function schemeRows(exercise:Exercise,options:PrescriptionOptions):SetPrescription[]{
 const count=Math.max(1,Math.min(20,Math.trunc(options.targetSets||exercise.baseSets))),range=defaultRepRange(exercise,options.repRange),base=usableLoad(exercise,options.plannedWeight)?options.plannedWeight!:exercise.baseWeight,scheme=options.setScheme||'straight';
 const rows=Array.from({length:count},(_,index)=>{
  let weight=base,minReps=range.min,maxReps=range.max,role:'working'|'amrap'|'drop'='working',repTargetMode:'range'|'amrap'='range';
  if(scheme==='ascending_pyramid'){
   weight=base+stepFor(exercise)*index;minReps=Math.max(range.min,range.max-index*2);maxReps=minReps;
  }else if(scheme==='reverse_pyramid'){
   weight=base+stepFor(exercise)*(count-index-1);minReps=Math.min(range.max,range.min+index*2);maxReps=minReps;
  }else if(scheme==='amrap'&&index===count-1){role='amrap';repTargetMode='amrap';minReps=range.min;maxReps=range.max;}
  let tiers:NonNullable<SetPrescription['tiers']>|undefined;
  if(scheme==='drop_multi_tier'){
   role='drop';const dropWeight=base>0?round(base*.9):0;
   tiers=[{order:1,targetWeight:weight,minReps:range.min,maxReps:range.max},{order:2,targetWeight:dropWeight,minReps:range.min,maxReps:range.max}];
  }
  return {role,countsTowardProgression:true,targetWeight:weight,minReps,maxReps,repTargetMode,group:'working',...(tiers?{tiers}:{})};
 });
 return rows;
}
const attempted=(s:SetLog)=>['completed','modified','failed'].includes(s.status)&&Number.isFinite(s.weight)&&Number.isFinite(s.reps);
const successful=(s:SetLog)=>s.status==='completed'&&s.reps>0;
const eligible=(s:SetLog)=>s.prescription?.countsTowardProgression!==false;
const prescriptionOf=(s:SetLog):SetPrescription=>{const row=s.manualTargetOverride?s.prescription:s.sessionPrescription||s.prescription;return row?{...row}:{role:'unclassified',countsTowardProgression:true,targetWeight:s.targetWeight,minReps:Math.max(1,s.targetReps),maxReps:Math.max(1,s.targetReps)}};
const rowsOf=(entry:Workout['entries'][number])=>entry.sets.map(prescriptionOf);
const entryFor=(w:Workout,id:string)=>w.entries.find(e=>e.exerciseId===id);
const policyKey=(p?:ProgressionPolicy)=>p?JSON.stringify([p.kind,p.scope||'group',p.advanceBy||'auto',p.successSessions||2,p.failureAction||'hold']):'legacy';
const samePolicy=(a:ProgressionPolicy|undefined,b:ProgressionPolicy)=>!!a&&policyKey(a)===policyKey(b);
function rowsCompatible(a:SetPrescription[],b:SetPrescription[]){
 const common=Math.min(a.length,b.length);
 for(let i=0;i<common;i++){
  const x=a[i],y=b[i];
  if(x.role!==y.role||x.countsTowardProgression!==y.countsTowardProgression||(x.group||'')!==(y.group||''))return false;
  if((x.repTargetMode||'range')!==(y.repTargetMode||'range')||(x.tiers?.length||0)!==(y.tiers?.length||0))return false;
  if(Math.max(x.minReps,y.minReps)>Math.min(x.maxReps,y.maxReps))return false;
 }
 const extra=a.length>b.length?a.slice(common):b.slice(common);
 return extra.every(x=>x.countsTowardProgression&&['working','top','backoff','amrap','drop','unclassified'].includes(x.role));
}
const actualPlanWeight=(s:SetLog)=>(s.manualTargetOverride?s.prescription:s.sessionPrescription||s.prescription)?.targetWeight??s.targetWeight;
const effectivePrescription=(s:SetLog)=>s.manualTargetOverride?s.prescription:s.sessionPrescription||s.prescription;
const tierSequenceComplete=(s:SetLog)=>!effectivePrescription(s)?.tiers?.length||(s.tierActuals?.length===effectivePrescription(s)!.tiers!.length&&s.tierActuals.every(t=>['completed','modified'].includes(t.status)&&t.actualWeight!==undefined&&t.actualReps!==undefined));
const tierSequenceSuccessful=(s:SetLog)=>{const row=effectivePrescription(s);return tierSequenceComplete(s)&&(!row?.tiers?.length||s.tierActuals!.every(t=>t.status==='completed'&&t.actualWeight===(t.adaptedTargetWeight??t.targetWeight)&&t.actualReps!>=(t.adaptedTargetMinReps??t.targetMinReps)));};
const sessionAdjusted=(s:SetLog)=>!!s.manualTargetOverride||s.status==='modified'&&!s.adaptationReason||Math.abs(s.weight-actualPlanWeight(s))>1e-6||(s.tierActuals||[]).some(t=>t.manuallyAdjusted||t.status!=='completed');
function withLoad(row:SetPrescription,exercise:Exercise,load:number,direction:'up'|'down'='up'):SetPrescription{
 if(!row.tiers?.length)return {...row,targetWeight:load};
 const tiers=row.tiers.map(t=>{const choice=direction==='up'?nextValidLoad(exercise,t.targetWeight):previousValidLoad(exercise,t.targetWeight);return {...t,targetWeight:choice.load??Math.max(0,round(t.targetWeight+(load-row.targetWeight)))};});
 return {...row,targetWeight:load,tiers};
}
function withRepProgress(row:SetPrescription):SetPrescription{return {...row,minReps:Math.min(100,row.minReps+1),maxReps:Math.min(100,row.maxReps+1),...(row.tiers?.length?{tiers:row.tiers.map(t=>({...t,minReps:Math.min(100,t.minReps+1),maxReps:Math.min(100,t.maxReps+1)}))}:{})};}
function effortMet(set:SetLog,row:SetPrescription){
 if(row.targetRir!==undefined&&set.actualRir!==undefined)return set.actualRir>=row.targetRir;
 if(row.targetRpe!==undefined&&set.actualRpe!==undefined)return set.actualRpe<=row.targetRpe;
 return set.difficulty!=='Very Hard'&&set.difficulty!=='Failed';
}
function entryMisses(entry:Workout['entries'][number]){
 return entry.sets.some(set=>eligible(set)&&!sessionAdjusted(set)&&attempted(set)&&(
  set.status==='failed'||set.difficulty==='Failed'||set.reps<(effectivePrescription(set)?.minReps??set.targetReps)||!tierSequenceSuccessful(set)
 ));
}
function dayGap(a:string,b:string){const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/86400000:Infinity;}
function targetOf(rows:SetPrescription[],fallback:number,exercise:Exercise,override?:Target):Target{
 const working=rows.filter(x=>x.countsTowardProgression);
 return {weight:override?.weight??(working.length?Math.max(...working.map(x=>x.targetWeight)):fallback),reps:override?.reps??(working.length?Math.min(...working.map(x=>x.minReps)):exercise.baseReps),sets:override?.sets??(rows.length||exercise.baseSets)};
}
const evidenceFor=(kind:ProgressionEvidence['kind'],detail:string,workoutId?:string,setId?:string):ProgressionEvidence=>({kind,detail,...(workoutId?{workoutId}:{}),...(setId?{setId}:{})});

export function recommendProgression(data:Data,exercise:Exercise,policy:ProgressionPolicy=defaultProgressionPolicy(exercise),current?:SetPrescription[],context?:string,options:PrescriptionOptions={}):ProgressionResult{
 const requested=policy.advanceBy||'auto',need=Math.max(1,policy.successSessions||2),contextKey=context??null;
 const scheme=options.setScheme||'straight';
 const candidates=data.workouts.filter(w=>w.completed&&w.entries.some(e=>e.exerciseId===exercise.id&&(e.prescriptionContext??null)===contextKey&&(e.setScheme||'straight')===scheme)).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const firstCandidate=candidates[0],firstEntry=firstCandidate?{workout:firstCandidate,entry:entryFor(firstCandidate,exercise.id)!}:undefined;
 let rows=current?.length?current.map(x=>({...x})):firstEntry?rowsOf(firstEntry.entry):[];
 if(firstEntry&&current?.length&&rowsCompatible(current,rowsOf(firstEntry.entry)))rows=rowsOf(firstEntry.entry);
 if(!rows.length)rows=schemeRows(exercise,{...options,targetSets:options.targetSets||exercise.baseSets});
 const plannedRows=current?.length?current:[];
 // Incomplete failed legacy rows can contain zero as a missing-data sentinel.
 // Seed those loads from the current reusable plan, then successful actuals,
 // then the exercise's configured start; only genuinely new/bodyweight work
 // may keep zero without a historical load.
 const successfulHistory=data.workouts.filter(w=>w.completed).flatMap(w=>w.entries.filter(e=>e.exerciseId===exercise.id).map(e=>({workout:w,entry:e}))).sort((a,b)=>b.workout.date.localeCompare(a.workout.date));
 const sameContext=candidates.map(w=>({workout:w,entry:entryFor(w,exercise.id)!}));
 let gapDetected=false,longGapDays=0;
 const contiguous:{workout:Workout;entry:Workout['entries'][number]}[]=[];
 for(const item of sameContext){
  if(!rowsCompatible(rows,rowsOf(item.entry)))break;
  if(contiguous.length&&dayGap(contiguous[0].workout.date,item.workout.date)>HISTORY_GAP_DAYS){gapDetected=true;longGapDays=dayGap(contiguous[0].workout.date,item.workout.date);break;}
  if(!samePolicy(item.entry.progressionPolicy,policy))break;
  contiguous.push(item);
 }
 const latest=contiguous[0],latestRows=latest?rowsOf(latest.entry):rows;
 if(latest&&rowsCompatible(rows,latestRows))rows=latestRows;
 // Validate after selecting the newest comparable snapshot too: failed legacy
 // rows can be selected here after an earlier seed pass and reintroduce zero.
 rows=rows.map((row,index)=>{
  if(usableLoad(exercise,row.targetWeight))return row;
  const planned=plannedRows[index]?.targetWeight;
  const actual=successfulHistory.flatMap(item=>item.entry.sets).find(set=>set.status==='completed'&&usableLoad(exercise,set.weight))?.weight;
  const historySets=successfulHistory.flatMap(item=>item.entry.sets);
  const historicalPlan=historySets.find(set=>usableLoad(exercise,set.prescription?.targetWeight??set.targetWeight))?.prescription?.targetWeight??historySets.find(set=>usableLoad(exercise,set.targetWeight))?.targetWeight;
  const safePlan=usableLoad(exercise,planned)?planned:undefined,safeActual=usableLoad(exercise,actual)?actual:undefined,safeHistorical=usableLoad(exercise,historicalPlan)?historicalPlan:undefined;
  const fallback=safePlan??safeActual??safeHistorical??(usableLoad(exercise,exercise.baseWeight)?exercise.baseWeight:zeroLoadValid(exercise)?0:stepFor(exercise));
  return {...row,targetWeight:fallback};
 });
 const fallback=rows.length?Math.max(...rows.map(x=>x.targetWeight)):exercise.baseWeight;
 const workIndices=rows.map((r,i)=>r.countsTowardProgression?i:-1).filter(i=>i>=0),workRows=workIndices.map(i=>rows[i]);
 const comparable=contiguous;
 const recent=comparable.slice(0,need),currentSession=latest;
 const evidence:ProgressionEvidence[]=[];
 let kind:ProgressionResult['kind']=currentSession?'Repeat':'Baseline',reasonCode:ProgressionReasonCode=currentSession?'insufficient_history':candidates.length?'insufficient_history':'baseline';
 let why=currentSession?'Repeat this prescription while building comparable evidence.':candidates.length?'Recent records use a different set structure or progression policy, so start a fresh comparison.':'Start with the saved targets; there is not enough comparable history to change them.';
 let overridden=false;
 const manualOverride=data.overrides?.[exercise.id];
 const markManual=(detail:string)=>evidence.push(evidenceFor('manual',detail));

 if(policy.kind==='fixed'){
  kind='Hold';reasonCode='fixed_prescription';why='This prescription is fixed, so automatic progression leaves it unchanged.';markManual('Fixed policy: the saved set targets are unchanged.');
 }else if(!workRows.length){
  kind='Hold';reasonCode='no_progression_sets';why='No sets are marked to drive progression, so the recommendation stays unchanged.';evidence.push(evidenceFor('role','Every set is excluded from progression.'));
 }else if(!currentSession){
  evidence.push(evidenceFor('insufficient','No completed workout matches this exercise, template version, set structure, and progression policy.'));
 }else{
  const logged=currentSession.entry.sets;
  const aligned=workIndices.map((index,j)=>({index,row:workRows[j],set:logged[index]})).filter(x=>!!x.set&&attempted(x.set)&&eligible(x.set));
  const adjusted=aligned.filter(x=>sessionAdjusted(x.set));
  const usable=aligned.filter(x=>!sessionAdjusted(x.set));
  const misses=usable.filter(({set,row})=>set.status==='failed'||set.difficulty==='Failed'||set.reps<row.minReps);
  for(const {set,row} of aligned){
   if(sessionAdjusted(set))evidence.push(evidenceFor('modified',`This set used an adjusted target or load; it is kept in history but excluded from progression confirmation.`,currentSession.workout.id,set.id));
   else if(set.status==='failed'||set.difficulty==='Failed'||set.reps<row.minReps)evidence.push(evidenceFor('miss',`${set.reps} reps at ${set.weight} lb missed the minimum of ${row.minReps}.`,currentSession.workout.id,set.id));
   else evidence.push(evidenceFor('success',`${set.reps} reps at ${set.weight} lb; target range ${row.minReps}–${row.maxReps}.`,currentSession.workout.id,set.id));
  }
  const gapDays=comparable.length>1?dayGap(comparable[0].workout.date,comparable[1].workout.date):0;
  const longGap=gapDetected||gapDays>HISTORY_GAP_DAYS;
  if(longGap){kind='Repeat';reasonCode='long_gap';why='There was a long break between comparable sessions. Repeat the target and rebuild recent evidence.';evidence.push(evidenceFor('history',`The ${Math.floor(longGapDays||gapDays)}-day gap starts a new comparison period.`,currentSession.workout.id));}
  else if(misses.length){
   const repeated=comparable.slice(0,Math.max(2,need)).length>=Math.max(2,need)&&comparable.slice(0,Math.max(2,need)).every(x=>entryMisses(x.entry));
   if(repeated&&policy.failureAction==='reduce_load'){
    let reduced=false;
    rows=rows.map((r,i)=>{if(!r.countsTowardProgression)return r;const choice=previousValidLoad(exercise,r.targetWeight);if(choice.load===null){evidence.push(evidenceFor('equipment',`No previous valid load is available below ${r.targetWeight} lb; this set stays unchanged.`));return r;}reduced=true;evidence.push(evidenceFor('load',`Load reduced from ${r.targetWeight} lb to the previous available ${choice.load} lb.`));return withLoad(r,exercise,choice.load,'down');});
    kind=reduced?'Reduce':'Hold';reasonCode='repeated_underperformance';why=reduced?'Comparable sessions repeatedly missed their minimums, so working loads drop to the previous available settings.':'Repeated misses were recorded, but equipment has no lower valid load; targets stay unchanged.';
   }else if(repeated&&policy.failureAction==='reduce_volume'){
    let removed=false;rows=rows.filter(r=>{if(!removed&&r.countsTowardProgression){removed=true;return false;}return true;});kind=removed?'Reduce':'Hold';reasonCode='repeated_underperformance';why=removed?'Comparable sessions repeatedly missed their minimums, so one working set is removed.':'Repeated misses were recorded, but there is no working set to remove.';
   }else{kind='Hold';reasonCode='missed_minimum';why='A working set missed its minimum target. Repeat the prescription before considering a reduction.';}
  }else if(adjusted.length){
   kind='Hold';reasonCode='session_adjustment';why='A target or load changed during this workout. Its performance is saved, but the original prescription is repeated for a clean comparison.';
  }else if(recent.length<need){
   kind='Repeat';reasonCode='insufficient_history';why='There is not enough recent performance at this prescription to justify an increase.';evidence.push(evidenceFor('insufficient',`${recent.length} of ${need} comparable successful sessions are available.`));
  }else{
   const perSession=(item:{workout:Workout;entry:Workout['entries'][number]},index:number)=>{
    const set=item.entry.sets[index],row=prescriptionOf(set);
    return !!set&&successful(set)&&eligible(set)&&!sessionAdjusted(set)&&tierSequenceSuccessful(set)&&set.reps>=row.maxReps&&effortMet(set,row);
   };
   const groupConfirmed=workIndices.every(index=>recent.every(item=>perSession(item,index)));
   const reachedLatestFor=(index:number)=>{const set=logged[index],row=rows[index];return !!set&&successful(set)&&eligible(set)&&!sessionAdjusted(set)&&tierSequenceSuccessful(set)&&set.reps>=row.maxReps&&effortMet(set,row);};
   const independent=(policy.scope||'group')==='independent',reachedLatest=workIndices.every(reachedLatestFor),reachedAnyLatest=workIndices.some(reachedLatestFor);
   const advance=requested==='auto'?(exercise.mode==='reps'||exercise.loadAvailability?.kind==='bodyweight'?'reps':'load'):requested;
   if((independent?reachedAnyLatest:reachedLatest)&&(independent||groupConfirmed)){
    if(independent){
     let loadChanged=false,repChanged=false;
     rows=rows.map((row,index)=>{
      if(!row.countsTowardProgression||!recent.every(item=>perSession(item,index)))return row;
      if(advance==='sets')return row;
      if(advance==='reps'){repChanged=true;evidence.push(evidenceFor('reps',`Set ${index+1} rep target advances by one.`));return withRepProgress(row);}
      const next=nextValidLoad(exercise,row.targetWeight);
      if(next.load===null){evidence.push(evidenceFor('equipment',equipmentMessage(next.reason,row.targetWeight)));repChanged=true;return {...row,minReps:Math.min(100,row.minReps+1),maxReps:Math.min(100,row.maxReps+1)};}
      loadChanged=true;evidence.push(evidenceFor('load',`Set ${index+1} advances from ${row.targetWeight} lb to the next available ${next.load} lb.`));return withLoad(row,exercise,next.load);
     });
     if(loadChanged||repChanged){kind='Increase';reasonCode=advance==='reps'?'rep_progress':repChanged?'equipment_limited':'confirmed_progress';why=reasonCode==='equipment_limited'?'At least one set has no practical next load, so that set progresses through reps instead.':'Sets that reached the top of their ranges across confirmed sessions progress independently.';}
     else{kind='Repeat';reasonCode='mixed_performance';why='No individual working set has enough consistent evidence to advance.';}
    }else if(advance==='sets'){
     const lastIndex=workIndices.at(-1)!,last=rows[lastIndex];if(rows.length<20){rows.push({...last,id:undefined});kind='Increase';reasonCode='confirmed_progress';why='Every working set reached its upper target in recent comparable sessions, so one working set is added.';evidence.push(evidenceFor('reps','Added one working set while preserving its load and rep range.'));}
     else{kind='Hold';reasonCode='mixed_performance';why='The set limit has been reached; the prescription stays unchanged.';}
    }else if(advance==='reps'){
     rows=rows.map(r=>r.countsTowardProgression?withRepProgress(r):r);kind='Increase';reasonCode='rep_progress';why='Working sets reached the top of their ranges at acceptable effort across recent sessions, so their rep targets advance by one.';evidence.push(evidenceFor('reps','Each working rep range advances by one; load is unchanged.'));
    }else{
     const choices=workIndices.map(i=>nextValidLoad(exercise,rows[i].targetWeight));
     if(choices.every(x=>x.load!==null)){
      rows=rows.map((r,i)=>r.countsTowardProgression?withLoad(r,exercise,choices[workIndices.indexOf(i)].load!):r);kind='Increase';reasonCode='confirmed_progress';why='Every working set reached the top of its range at acceptable effort across recent sessions; each advances to its next available load.';
      workIndices.forEach((i,j)=>evidence.push(evidenceFor('load',`Set ${i+1} advances from ${workRows[j].targetWeight} lb to ${choices[j].load} lb.`)));
     }else{
      rows=rows.map(r=>r.countsTowardProgression?withRepProgress(r):r);kind='Increase';reasonCode='equipment_limited';why='The next available load is unavailable or too large a jump, so working rep ranges advance while load stays the same.';
      choices.forEach((choice,j)=>{if(choice.load===null)evidence.push(evidenceFor('equipment',equipmentMessage(choice.reason,workRows[j].targetWeight)));});evidence.push(evidenceFor('reps','Rep ranges advance by one because a suitable load increase is unavailable.'));
     }
    }
   }else if(independent?reachedAnyLatest:reachedLatest){kind='Repeat';reasonCode='insufficient_history';why='The top of the range was reached, but not across enough comparable sessions to increase difficulty.';evidence.push(evidenceFor('insufficient',`Upper-range performance is required in ${need} recent comparable sessions.`));}
   else{kind='Repeat';reasonCode='mixed_performance';why='Performance is building within the range. Hold load and keep working toward its upper end.';}
  }
 }
 if(manualOverride){rows=rows.map(r=>({...r,targetWeight:manualOverride.weight,minReps:manualOverride.reps,maxReps:manualOverride.reps}));kind='Hold';reasonCode='manual_override';why='Your saved target remains in control. Clear or change it to resume automatic progression.';overridden=true;markManual(`Saved manual target: ${manualOverride.weight} lb × ${manualOverride.reps} reps for ${manualOverride.sets} sets.`);}
 const target=targetOf(rows,fallback,exercise,overridden?manualOverride:undefined);
 return {target,prescription:rows,kind,reasonCode,why,evidence,overridden,calibrating:comparable.length<need};
}

export function adaptRemainingTargets(exercise:Exercise,sets:SetLog[],completedSetId:string):{sets:SetLog[];changed:number}{
 const sourceIndex=sets.findIndex(set=>set.id===completedSetId),source=sets[sourceIndex];
 if(sourceIndex<0||!source||source.status==='pending'||source.status==='skipped'||source.manualTargetOverride)return {sets,changed:0};
 const target=source.sessionPrescription||source.prescription||{role:'working' as const,countsTowardProgression:true,targetWeight:source.targetWeight,minReps:Math.max(1,source.targetReps),maxReps:Math.max(1,source.targetReps)};
 const miss=source.status==='failed'||source.difficulty==='Failed'||source.reps<target.minReps;
 const tooHard=source.difficulty==='Very Hard'||source.actualRir!==undefined&&source.actualRir<1;
 const loadChanged=Math.abs(source.weight-target.targetWeight)>1e-6;
 const fullyCompletedTiers=!!target.tiers?.length&&tierSequenceComplete(source)&&tierSequenceSuccessful(source);
 const partialTiers=!!target.tiers?.length&&!fullyCompletedTiers;
 let loadDelta=0,repDelta=0,reason='';
 if(target.tiers?.length){
  const tierRows=source.tierActuals||[];
  const tierFailed=tierRows.some(t=>t.status==='failed');
  const tierSkipped=tierRows.some(t=>t.status==='skipped');
  const changedTier=tierRows.some(t=>t.manuallyAdjusted||t.status==='modified');
  const allComfortable=fullyCompletedTiers&&tierRows.every((t,index)=>t.actualReps!>=(target.tiers![index].maxReps)&&source.difficulty==='Easy');
  if(tierFailed){loadDelta=-stepFor(exercise);reason='Adjusted later tiers after a failed tier';}
  else if(tierSkipped||changedTier||partialTiers){reason='Held tier targets after a partial or modified sequence';}
  else if(allComfortable){repDelta=1;reason='Added one rep to later tiers after an easy complete sequence';}
  else reason='Held later tiers after a completed set sequence';
 }else if(loadChanged){loadDelta=source.weight-target.targetWeight;reason='Adjusted later targets to match the performed load';}
 else if(miss){const lower=previousValidLoad(exercise,target.targetWeight);if(lower.load!==null){loadDelta=lower.load-target.targetWeight;reason='Reduced later targets after a missed minimum';}else{repDelta=Math.min(0,target.minReps-source.reps);reason='Held load and adjusted later reps after a missed minimum';}}
 else if(tooHard){reason='Held after a difficult set';}
 else if(source.status==='completed'&&source.difficulty==='Easy'&&source.reps>=target.maxReps){const next=nextValidLoad(exercise,target.targetWeight);if(next.load!==null){loadDelta=next.load-target.targetWeight;reason='Increased later targets by one available load step after an easy set';}else{repDelta=1;reason='Added one rep to later targets because no safe load step is available';}}
 if(!reason)return {sets,changed:0};
 if(!loadDelta&&!repDelta){let changed=0;const held=sets.map((set,index)=>{if(index<=sourceIndex||set.status!=='pending'||set.manualTargetOverride)return set;changed++;return {...set,adaptationReason:reason};});return {sets:held,changed};}
 let changed=0;
 const adapted=sets.map((set,index)=>{
  if(index<=sourceIndex||set.status!=='pending'||set.manualTargetOverride)return set;
  const prior=set.sessionPrescription||set.prescription||{role:'working' as const,countsTowardProgression:true,targetWeight:set.targetWeight,minReps:Math.max(1,set.targetReps),maxReps:Math.max(1,set.targetReps)};
  let next: SetPrescription={...prior,targetWeight:Math.max(0,round(prior.targetWeight+loadDelta)),minReps:Math.max(1,Math.min(100,prior.minReps+repDelta)),maxReps:Math.max(1,Math.min(100,prior.maxReps+repDelta))};
  if(prior.tiers?.length){
   const tierActuals=prior.tiers.map(t=>{const old=set.tierActuals?.find(actual=>actual.order===t.order),weight=Math.max(0,round((old?.adaptedTargetWeight??t.targetWeight)+loadDelta));return {...(old||{order:t.order,targetWeight:t.targetWeight,targetMinReps:t.minReps,targetMaxReps:t.maxReps,status:'pending' as const}),adaptedTargetWeight:weight,adaptedTargetMinReps:Math.max(1,(old?.adaptedTargetMinReps??t.minReps)+repDelta),adaptedTargetMaxReps:Math.max(1,(old?.adaptedTargetMaxReps??t.maxReps)+repDelta)};});
   next={...next,tiers:prior.tiers.map(t=>({...t,targetWeight:Math.max(0,round(t.targetWeight+loadDelta)),minReps:Math.max(1,t.minReps+repDelta),maxReps:Math.max(1,t.maxReps+repDelta)}))};
   changed++;
   return {...set,sessionPrescription:next,targetWeight:next.targetWeight,targetReps:next.minReps,weight:next.targetWeight,reps:next.minReps,tierActuals,adaptationReason:reason};
  }
  changed++;
  return {...set,sessionPrescription:next,targetWeight:next.targetWeight,targetReps:next.minReps,weight:next.targetWeight,reps:next.minReps,adaptationReason:reason};
 });
 return {sets:adapted,changed};
}

function equipmentMessage(reason:LoadChoice['reason'],current:number){
 if(reason==='jump_too_large')return `The next listed load above ${current} lb exceeds the configured largest jump.`;
 if(reason==='no_higher_load')return `There is no higher available load above ${current} lb.`;
 if(reason==='bodyweight')return 'This movement is configured for bodyweight only; it advances through reps.';
 if(reason==='no_lower_load')return `There is no lower available load below ${current} lb.`;
 return 'A suitable load is available.';
}
