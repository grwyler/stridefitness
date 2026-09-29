import type {Data,Exercise,LoadAvailability,ProgressionPolicy,SetLog,SetPrescription,Target,Workout} from './training';

export type ProgressionReasonCode='baseline'|'fixed_prescription'|'manual_override'|'no_progression_sets'|'insufficient_history'|'mixed_performance'|'missed_minimum'|'repeated_underperformance'|'confirmed_progress'|'rep_progress'|'equipment_limited'|'session_adjustment'|'long_gap';
export type ProgressionEvidence={kind:'success'|'miss'|'effort'|'insufficient'|'load'|'reps'|'equipment'|'role'|'manual'|'modified'|'history';workoutId?:string;setId?:string;detail:string};
export type ProgressionResult={target:Target;prescription:SetPrescription[];kind:'Baseline'|'Repeat'|'Increase'|'Hold'|'Reduce';reasonCode:ProgressionReasonCode;why:string;evidence:ProgressionEvidence[];overridden:boolean;calibrating:boolean};
export type LoadChoice={load:number|null;reason:'available'|'no_higher_load'|'jump_too_large'|'bodyweight'|'no_lower_load'};

const HISTORY_GAP_DAYS=42;
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

export const defaultProgressionPolicy=(exercise:Exercise):ProgressionPolicy=>({kind:'rep_range',scope:'group',advanceBy:exercise.mode==='volume'?'sets':exercise.mode==='reps'?'reps':'auto',successSessions:2,failureAction:'hold'});
const attempted=(s:SetLog)=>['completed','modified','failed'].includes(s.status)&&Number.isFinite(s.weight)&&Number.isFinite(s.reps);
const successful=(s:SetLog)=>s.status==='completed'&&s.reps>0;
const eligible=(s:SetLog)=>s.prescription?.countsTowardProgression!==false;
const prescriptionOf=(s:SetLog):SetPrescription=>s.prescription?{...s.prescription}:{role:'unclassified',countsTowardProgression:true,targetWeight:s.targetWeight,minReps:Math.max(1,s.targetReps),maxReps:Math.max(1,s.targetReps)};
const rowsOf=(entry:Workout['entries'][number])=>entry.sets.map(prescriptionOf);
const entryFor=(w:Workout,id:string)=>w.entries.find(e=>e.exerciseId===id);
const policyKey=(p?:ProgressionPolicy)=>p?JSON.stringify([p.kind,p.scope||'group',p.advanceBy||'auto',p.successSessions||2,p.failureAction||'hold']):'legacy';
const samePolicy=(a:ProgressionPolicy|undefined,b:ProgressionPolicy)=>!!a&&policyKey(a)===policyKey(b);
function rowsCompatible(a:SetPrescription[],b:SetPrescription[]){
 const common=Math.min(a.length,b.length);
 for(let i=0;i<common;i++){
  const x=a[i],y=b[i];
  if(x.role!==y.role||x.countsTowardProgression!==y.countsTowardProgression||(x.group||'')!==(y.group||''))return false;
  if(Math.max(x.minReps,y.minReps)>Math.min(x.maxReps,y.maxReps))return false;
 }
 const extra=a.length>b.length?a.slice(common):b.slice(common);
 return extra.every(x=>x.countsTowardProgression&&['working','top','backoff','amrap','drop','unclassified'].includes(x.role));
}
const actualPlanWeight=(s:SetLog)=>s.prescription?.targetWeight??s.targetWeight;
const sessionAdjusted=(s:SetLog)=>!!s.sessionPrescription||s.status==='modified'||Math.abs(s.weight-actualPlanWeight(s))>1e-6;
function effortMet(set:SetLog,row:SetPrescription){
 if(row.targetRir!==undefined&&set.actualRir!==undefined)return set.actualRir>=row.targetRir;
 if(row.targetRpe!==undefined&&set.actualRpe!==undefined)return set.actualRpe<=row.targetRpe;
 return set.difficulty!=='Very Hard'&&set.difficulty!=='Failed';
}
function entryMisses(entry:Workout['entries'][number]){
 return entry.sets.some(set=>eligible(set)&&!sessionAdjusted(set)&&attempted(set)&&(
  set.status==='failed'||set.difficulty==='Failed'||set.reps<(set.prescription?.minReps??set.targetReps)
 ));
}
function dayGap(a:string,b:string){const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/86400000:Infinity;}
function targetOf(rows:SetPrescription[],fallback:number,exercise:Exercise,override?:Target):Target{
 const working=rows.filter(x=>x.countsTowardProgression);
 return {weight:override?.weight??(working.length?Math.max(...working.map(x=>x.targetWeight)):fallback),reps:override?.reps??(working.length?Math.min(...working.map(x=>x.minReps)):exercise.baseReps),sets:override?.sets??(rows.length||exercise.baseSets)};
}
const evidenceFor=(kind:ProgressionEvidence['kind'],detail:string,workoutId?:string,setId?:string):ProgressionEvidence=>({kind,detail,...(workoutId?{workoutId}:{}),...(setId?{setId}:{})});

export function recommendProgression(data:Data,exercise:Exercise,policy:ProgressionPolicy=defaultProgressionPolicy(exercise),current?:SetPrescription[],context?:string):ProgressionResult{
 const requested=policy.advanceBy||'auto',need=Math.max(1,policy.successSessions||2),contextKey=context??null;
 const candidates=data.workouts.filter(w=>w.completed&&w.entries.some(e=>e.exerciseId===exercise.id&&(e.prescriptionContext??null)===contextKey)).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const firstCandidate=candidates[0],firstEntry=firstCandidate?{workout:firstCandidate,entry:entryFor(firstCandidate,exercise.id)!}:undefined;
 let rows=current?.length?current.map(x=>({...x})):firstEntry?rowsOf(firstEntry.entry):[];
 if(firstEntry&&current?.length&&rowsCompatible(current,rowsOf(firstEntry.entry)))rows=rowsOf(firstEntry.entry);
 if(!rows.length)rows=Array.from({length:exercise.baseSets},()=>({role:'working',countsTowardProgression:true,targetWeight:exercise.baseWeight,minReps:exercise.baseReps,maxReps:exercise.baseReps+4,group:'working'}));
 const fallback=rows.length?Math.max(...rows.map(x=>x.targetWeight)):exercise.baseWeight;
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
    rows=rows.map((r,i)=>{if(!r.countsTowardProgression)return r;const choice=previousValidLoad(exercise,r.targetWeight);if(choice.load===null){evidence.push(evidenceFor('equipment',`No previous valid load is available below ${r.targetWeight} lb; this set stays unchanged.`));return r;}reduced=true;evidence.push(evidenceFor('load',`Load reduced from ${r.targetWeight} lb to the previous available ${choice.load} lb.`));return {...r,targetWeight:choice.load};});
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
    return !!set&&successful(set)&&eligible(set)&&!sessionAdjusted(set)&&set.reps>=row.maxReps&&effortMet(set,row);
   };
   const groupConfirmed=workIndices.every(index=>recent.every(item=>perSession(item,index)));
   const reachedLatestFor=(index:number)=>{const set=logged[index],row=rows[index];return !!set&&successful(set)&&eligible(set)&&!sessionAdjusted(set)&&set.reps>=row.maxReps&&effortMet(set,row);};
   const independent=(policy.scope||'group')==='independent',reachedLatest=workIndices.every(reachedLatestFor),reachedAnyLatest=workIndices.some(reachedLatestFor);
   const advance=requested==='auto'?(exercise.mode==='reps'||exercise.loadAvailability?.kind==='bodyweight'?'reps':'load'):requested;
   if((independent?reachedAnyLatest:reachedLatest)&&(independent||groupConfirmed)){
    if(independent){
     let loadChanged=false,repChanged=false;
     rows=rows.map((row,index)=>{
      if(!row.countsTowardProgression||!recent.every(item=>perSession(item,index)))return row;
      if(advance==='sets')return row;
      if(advance==='reps'){repChanged=true;evidence.push(evidenceFor('reps',`Set ${index+1} rep target advances by one.`));return {...row,minReps:Math.min(100,row.minReps+1),maxReps:Math.min(100,row.maxReps+1)};}
      const next=nextValidLoad(exercise,row.targetWeight);
      if(next.load===null){evidence.push(evidenceFor('equipment',equipmentMessage(next.reason,row.targetWeight)));repChanged=true;return {...row,minReps:Math.min(100,row.minReps+1),maxReps:Math.min(100,row.maxReps+1)};}
      loadChanged=true;evidence.push(evidenceFor('load',`Set ${index+1} advances from ${row.targetWeight} lb to the next available ${next.load} lb.`));return {...row,targetWeight:next.load};
     });
     if(loadChanged||repChanged){kind='Increase';reasonCode=advance==='reps'?'rep_progress':repChanged?'equipment_limited':'confirmed_progress';why=reasonCode==='equipment_limited'?'At least one set has no practical next load, so that set progresses through reps instead.':'Sets that reached the top of their ranges across confirmed sessions progress independently.';}
     else{kind='Repeat';reasonCode='mixed_performance';why='No individual working set has enough consistent evidence to advance.';}
    }else if(advance==='sets'){
     const lastIndex=workIndices.at(-1)!,last=rows[lastIndex];if(rows.length<20){rows.push({...last,id:undefined});kind='Increase';reasonCode='confirmed_progress';why='Every working set reached its upper target in recent comparable sessions, so one working set is added.';evidence.push(evidenceFor('reps','Added one working set while preserving its load and rep range.'));}
     else{kind='Hold';reasonCode='mixed_performance';why='The set limit has been reached; the prescription stays unchanged.';}
    }else if(advance==='reps'){
     rows=rows.map(r=>r.countsTowardProgression?{...r,minReps:Math.min(100,r.minReps+1),maxReps:Math.min(100,r.maxReps+1)}:r);kind='Increase';reasonCode='rep_progress';why='Working sets reached the top of their ranges at acceptable effort across recent sessions, so their rep targets advance by one.';evidence.push(evidenceFor('reps','Each working rep range advances by one; load is unchanged.'));
    }else{
     const choices=workIndices.map(i=>nextValidLoad(exercise,rows[i].targetWeight));
     if(choices.every(x=>x.load!==null)){
      rows=rows.map((r,i)=>r.countsTowardProgression?{...r,targetWeight:choices[workIndices.indexOf(i)].load!}:r);kind='Increase';reasonCode='confirmed_progress';why='Every working set reached the top of its range at acceptable effort across recent sessions; each advances to its next available load.';
      workIndices.forEach((i,j)=>evidence.push(evidenceFor('load',`Set ${i+1} advances from ${workRows[j].targetWeight} lb to ${choices[j].load} lb.`)));
     }else{
      rows=rows.map(r=>r.countsTowardProgression?{...r,minReps:Math.min(100,r.minReps+1),maxReps:Math.min(100,r.maxReps+1)}:r);kind='Increase';reasonCode='equipment_limited';why='The next available load is unavailable or too large a jump, so working rep ranges advance while load stays the same.';
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

function equipmentMessage(reason:LoadChoice['reason'],current:number){
 if(reason==='jump_too_large')return `The next listed load above ${current} lb exceeds the configured largest jump.`;
 if(reason==='no_higher_load')return `There is no higher available load above ${current} lb.`;
 if(reason==='bodyweight')return 'This movement is configured for bodyweight only; it advances through reps.';
 if(reason==='no_lower_load')return `There is no lower available load below ${current} lb.`;
 return 'A suitable load is available.';
}
