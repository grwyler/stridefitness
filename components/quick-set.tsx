'use client';
import {useEffect,useState} from 'react';
import type {SetLog,SetPrescription,SetTierActual} from '@/lib/training';
import {estimatedOneRepMax} from '@/lib/goals';
import {compoundLevelTargets,compoundStrengthLevel} from '@/lib/strength-levels';

function NumberEntry({value,onChange,label,max,integer=false}:{value:number;onChange:(n:number)=>void;label:string;max:number;integer?:boolean}){
 const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
 return <input type="number" inputMode={integer?'numeric':'decimal'} enterKeyHint="next" min={0} max={max} step={integer?1:.5} aria-label={label} value={text} onFocus={e=>e.currentTarget.select()} onChange={e=>{const v=e.target.value;setText(v);const n=Number(v);if(v!==''&&Number.isFinite(n)&&n>=0&&n<=max&&(!integer||Number.isInteger(n)))onChange(n)}} onBlur={()=>setText(String(value))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const row=e.currentTarget.closest('.quick-set');const next=integer?row?.querySelector<HTMLButtonElement>('.quick-complete'):row?.querySelector<HTMLInputElement>('input[inputmode="numeric"]');next?.focus()}}}/>;
}
type TierTarget=Pick<SetPrescription,'targetWeight'|'minReps'|'maxReps'>;
const targetWeight=(prescription:TierTarget,actual?:SetTierActual)=>actual?.adaptedTargetWeight??prescription.targetWeight;
const targetMin=(prescription:TierTarget,actual?:SetTierActual)=>actual?.adaptedTargetMinReps??prescription.minReps;
const targetMax=(prescription:TierTarget,actual?:SetTierActual)=>actual?.adaptedTargetMaxReps??prescription.maxReps;

export function QuickSet({set:s,index,exercise,next,onPatch,onDelete,onAdvance,onRecord,currentEstimate,exerciseId='',bodyweight=null,sex=null,ageRange=null}:{set:SetLog;index:number;exercise:string;next:boolean;onPatch:(patch:Partial<SetLog>)=>void;onDelete:()=>void;onAdvance:()=>void;onRecord?:(status:SetLog['status'],set:SetLog)=>void;currentEstimate?:number;exerciseId?:string;bodyweight?:number|null;sex?:'Male'|'Female'|null;ageRange?:'Under 18'|'18–29'|'30–44'|'45–59'|'60+'|'Prefer not to say'|null}){
 const label=`${exercise} set ${index+1}`;
 const context={bodyweight,sex,ageRange},setEstimate=estimatedOneRepMax(s.weight,s.reps),targets=compoundLevelTargets(exerciseId,context),recordLevel=compoundStrengthLevel(currentEstimate||0,exerciseId,context),setLevel=compoundStrengthLevel(setEstimate,exerciseId,context);
 const shown=s.sessionPrescription||s.prescription,tiers=shown?.tiers||[],isTiered=tiers.length>0;
 function record(status:SetLog['status']){onPatch({status});if(status!=='pending')onRecord?.(status,s);if(next&&status!=='pending')onAdvance()}
 function tierRows():SetTierActual[]{return tiers.map(t=>s.tierActuals?.find(actual=>actual.order===t.order)||{order:t.order,targetWeight:t.targetWeight,targetMinReps:t.minReps,targetMaxReps:t.maxReps,status:'pending'});}
 function patchTier(order:number,patch:Partial<SetTierActual>){onPatch({tierActuals:tierRows().map(actual=>actual.order===order?{...actual,...patch}:actual)});}
 function setTierStatus(order:number,status:SetTierActual['status']){
  const prescribed=tiers.find(t=>t.order===order);if(!prescribed)return;
  const row=tierRows().find(actual=>actual.order===order)!;
  const weight=row.actualWeight??targetWeight(prescribed,row),reps=row.actualReps??targetMin(prescribed,row);
  patchTier(order,{status,...(status==='skipped'?{actualWeight:undefined,actualReps:undefined}:['completed','failed','modified'].includes(status)?{actualWeight:weight,actualReps:reps,manuallyAdjusted:weight!==targetWeight(prescribed,row)}:{})});
 }
 function recordTierSequence(){
  const rows=tierRows();if(rows.some(t=>t.status==='pending'))return;
  const performed=rows.filter(t=>['completed','modified','failed'].includes(t.status));
  const status:SetLog['status']=rows.some(t=>t.status==='failed')?'failed':performed.length===0?'skipped':rows.some(t=>t.status==='skipped'||t.status==='modified'||t.manuallyAdjusted)?'modified':'completed';
  const first=performed[0];const recorded={...s,tierActuals:rows,status,weight:first?.actualWeight??0,reps:first?.actualReps??0};
  onPatch(recorded);onRecord?.(status,recorded);if(next)onAdvance();
 }
 const incompleteTier= isTiered&&tierRows().some(t=>t.status==='pending');
 const targetLine=shown&&shown.repTargetMode==='amrap'?`${shown.minReps}+ reps (AMRAP)`:shown&&shown.minReps!==shown.maxReps?`${shown.minReps}–${shown.maxReps}`:`${s.targetReps}`;
 return <div className={'quick-set '+s.status+(next?' current-set':'')} data-next-set={next?'true':undefined}>
  <div className="quick-set-heading"><strong>Set {index+1}{next?' · Up next':''}</strong>{(!next||s.status!=='pending')&&<span>{s.status==='pending'?'Not logged':s.status}</span>}</div>
  {isTiered?<>
   <p className="quick-target">Target: extended set · {tiers.length} load tiers</p>
   {tiers.map((tier,position)=>{const actual=tierRows().find(t=>t.order===tier.order)!,load=targetWeight(tier,actual),min=targetMin(tier,actual),max=targetMax(tier,actual);return <section className="tier-entry" key={tier.order} aria-label={`Tier ${tier.order} of ${tiers.length}`}>
    <h4>Tier {position+1} target</h4><p className="quick-target">{load>0?`${load} lb`:'Bodyweight'} × {min===max?min:`${min}–${max}`} reps</p>
    {actual.adaptedTargetWeight!==undefined&&<small>Adjusted today; original target {tier.targetWeight>0?`${tier.targetWeight} lb`:'bodyweight'} × {tier.minReps}–{tier.maxReps}</small>}
    <div className="quick-set-values"><label>Actual load · lb<NumberEntry value={actual.actualWeight??load} max={2000} label={`${label} tier ${tier.order} actual load`} onChange={value=>patchTier(tier.order,{actualWeight:value,entryEdited:true})}/></label><label>Actual reps<NumberEntry value={actual.actualReps??min} max={100} integer label={`${label} tier ${tier.order} actual reps`} onChange={value=>patchTier(tier.order,{actualReps:value,entryEdited:true})}/></label></div>
    <div className="quick-status" aria-label={`Tier ${tier.order} status`}>
      {(['completed','failed','skipped'] as const).map(status=><button key={status} aria-pressed={actual.status===status} onClick={()=>setTierStatus(tier.order,status)}>{status==='completed'?'Performed':status==='failed'?'Failed':'Skip tier'}</button>)}
      {actual.status!=='pending'&&<button onClick={()=>patchTier(tier.order,{status:'pending',actualWeight:undefined,actualReps:undefined,manuallyAdjusted:false})}>Undo tier status</button>}
    </div><small>{actual.status==='pending'?'Choose whether you performed, failed, or skipped this tier.':`Tier status: ${actual.status}`}</small>
   </section>})}
   <button className={'quick-complete '+(s.status==='pending'?'primary':'secondary')} disabled={s.status==='completed'||incompleteTier} onClick={recordTierSequence}>{s.status==='completed'?'Completed':incompleteTier?'Record each tier first':'Complete extended set'}</button>
  </>:<>
   <p className="quick-target">Target: {s.targetWeight>0?`${s.targetWeight} lb`:'Bodyweight'} × {targetLine}{shown&&shown.role!=='working'&&shown.role!=='unclassified'?` · ${shown.role}`:''}</p>
   <div className="quick-set-values"><label>Actual load · lb<NumberEntry value={s.weight} max={2000} label={label+' actual load'} onChange={weight=>onPatch({weight,actualEntryEdited:true})}/></label><label>Actual reps<NumberEntry value={s.reps} max={100} integer label={label+' actual reps'} onChange={reps=>onPatch({reps,actualEntryEdited:true})}/></label><button className={'quick-complete '+(s.status==='pending'?'primary':'secondary')} aria-label={s.status==='completed'?label+' completed':`Complete ${label}`} disabled={s.status==='completed'} onClick={()=>record('completed')}>{s.status==='completed'?'Completed':'Complete'}</button></div>
   <div className="quick-set-estimates" aria-live="polite"><span>Exercise estimate <strong>{currentEstimate?`${currentEstimate.toLocaleString('en-US')} lb`:'—'}</strong>{targets&&(recordLevel?<em title="Approximate level adjusted for body weight, sex, and age group" aria-label={`${recordLevel}, approximate level adjusted for body weight, sex, and age group`} className={'strength-level '+recordLevel.toLowerCase()}>{recordLevel}</em>:<em className="strength-level unrated">—</em>)}</span><span>This set <strong>{setEstimate?`${setEstimate.toLocaleString('en-US')} lb`:'—'}</strong>{targets&&(setLevel?<em title="Approximate level adjusted for body weight, sex, and age group" aria-label={`${setLevel}, approximate level adjusted for body weight, sex, and age group`} className={'strength-level '+setLevel.toLowerCase()}>{setLevel}</em>:<em className="strength-level unrated">—</em>)}</span></div>
   {(s.referencePerformance||s.adaptationReason||s.sessionPrescription&&s.prescription)&&<details className="quick-target-context"><summary>Target details</summary>{s.referencePerformance&&<p>Last session: {s.referencePerformance.weight>0?`${s.referencePerformance.weight} lb`:'Bodyweight'} × {s.referencePerformance.reps} reps</p>}{s.adaptationReason&&<p>{s.adaptationReason}</p>}{s.sessionPrescription&&s.prescription&&<p>Original plan: {s.prescription.targetWeight>0?`${s.prescription.targetWeight} lb`:'Bodyweight'} × {s.prescription.minReps===s.prescription.maxReps?s.prescription.minReps:`${s.prescription.minReps}–${s.prescription.maxReps}`} reps</p>}</details>}
   <details className="quick-set-details quick-more-options"><summary>More options</summary><section className="quick-option-group"><strong>Adjust today’s target</strong><label>Target load · lb<NumberEntry value={s.targetWeight} max={2000} label={label+' target load'} onChange={weight=>onPatch({targetWeight:weight,weight,manualTargetOverride:true,sessionPrescription:{...(shown||{role:'working',countsTowardProgression:true,targetWeight:s.targetWeight,minReps:s.targetReps,maxReps:s.targetReps}),targetWeight:weight}})}/></label><label>Target reps<NumberEntry value={s.targetReps} max={100} integer label={label+' target reps'} onChange={reps=>onPatch({targetReps:reps,reps,manualTargetOverride:true,sessionPrescription:{...(shown||{role:'working',countsTowardProgression:true,targetWeight:s.targetWeight,minReps:s.targetReps,maxReps:s.targetReps}),minReps:reps,maxReps:reps}})}/></label><small>For this workout only.</small></section><div className="quick-status">{(['failed','modified','skipped'] as const).map(status=><button key={status} aria-label={`${status==='skipped'?'Skip':status==='failed'?'Fail':'Mark modified'} ${label}`} aria-pressed={s.status===status} onClick={()=>record(status)}>{status==='skipped'?'Skip':status==='failed'?'Failed':'Modified'}</button>)}{s.status!=='pending'&&<button onClick={()=>record('pending')} aria-label={`Undo ${label}`}>Undo</button>}</div><section className="quick-option-group"><strong>Effort & notes</strong><label>Difficulty · optional<select aria-label={label+' difficulty'} value={s.difficulty} onChange={e=>onPatch({difficulty:e.target.value})}>{['Easy','Moderate','Hard','Very Hard','Failed'].map(v=><option key={v}>{v}</option>)}</select></label><label>Reps left · optional<input type="number" min="0" max="10" step="1" aria-label={label+' reps in reserve'} value={s.actualRir??''} onChange={e=>onPatch({actualRir:e.target.value===''?undefined:Number(e.target.value)})}/></label><label>Notes<input aria-label={label+' note'} value={s.notes} placeholder="What changed or how it felt" onChange={e=>onPatch({notes:e.target.value})}/></label><button className="text-button" onClick={onDelete}>Remove set {index+1}</button></section></details>
  </>}
  {isTiered&&s.adaptationReason&&<details className="quick-target-context"><summary>Target details</summary><p>{s.adaptationReason}</p></details>}
  {isTiered&&<details className="quick-set-details quick-more-options"><summary>More options</summary><button className="text-button" onClick={onDelete}>Remove set {index+1}</button></details>}
 </div>;
}
