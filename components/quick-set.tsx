'use client';
import {useEffect,useState} from 'react';
import type {SetLog} from '@/lib/training';
function NumberEntry({value,onChange,label,max,integer=false}:{value:number;onChange:(n:number)=>void;label:string;max:number;integer?:boolean}){
 const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
 return <input type="number" inputMode={integer?'numeric':'decimal'} enterKeyHint="next" min={0} max={max} step={integer?1:.5} aria-label={label} value={text} onFocus={e=>e.currentTarget.select()} onChange={e=>{const v=e.target.value;setText(v);const n=Number(v);if(v!==''&&Number.isFinite(n)&&n>=0&&n<=max&&(!integer||Number.isInteger(n)))onChange(n)}} onBlur={()=>setText(String(value))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const row=e.currentTarget.closest('.quick-set');const next=integer?row?.querySelector<HTMLButtonElement>('.quick-complete'):row?.querySelector<HTMLInputElement>('input[inputmode="numeric"]');next?.focus()}}}/>;
}
export function QuickSet({set:s,index,exercise,next,onPatch,onDelete,onAdvance,onRecord}:{set:SetLog;index:number;exercise:string;next:boolean;onPatch:(patch:Partial<SetLog>)=>void;onDelete:()=>void;onAdvance:()=>void;onRecord?:(status:SetLog['status'],set:SetLog)=>void}){
 const label=`${exercise} set ${index+1}`;
 function record(status:SetLog['status']){onPatch({status});if(status!=='pending')onRecord?.(status,s);if(next&&status!=='pending')onAdvance()}
 return <div className={'quick-set '+s.status+(next?' current-set':'')} data-next-set={next?'true':undefined}>
 <div className="quick-set-heading"><strong>Set {index+1}{next?' · Up next':''}</strong><span>{s.status==='pending'?'Not logged':s.status}</span></div>
 <p className="quick-target">Target: {s.targetWeight>0?`${s.targetWeight} lb`:'choose load'} × {s.targetReps} reps</p>
 <div className="quick-set-values"><label>Weight · lb<NumberEntry value={s.weight} max={2000} label={label+' weight'} onChange={weight=>onPatch({weight})}/></label><label>Reps<NumberEntry value={s.reps} max={100} integer label={label+' reps'} onChange={reps=>onPatch({reps})}/></label><button className={'quick-complete '+(s.status==='pending'?'primary':'secondary')} aria-label={s.status==='completed'?label+' completed':`Complete ${label}`} disabled={s.status==='completed'} onClick={()=>record('completed')}>{s.status==='completed'?'Completed':'Complete'}</button></div>
 <div className="quick-status">{(['failed','modified','skipped'] as const).map(status=><button key={status} aria-label={`${status==='skipped'?'Skip':status==='failed'?'Fail':'Mark modified'} ${label}`} aria-pressed={s.status===status} onClick={()=>record(status)}>{status==='skipped'?'Skip':status==='failed'?'Failed':'Modified'}</button>)}{s.status!=='pending'&&<button onClick={()=>record('pending')} aria-label={`Undo ${label}`}>Undo</button>}</div>
 <details className="quick-set-details"><summary>Effort & notes{s.notes?' · note added':''}{s.difficulty!=='Moderate'?` · ${s.difficulty}`:''}</summary><label>Difficulty · optional<select aria-label={label+' difficulty'} value={s.difficulty} onChange={e=>onPatch({difficulty:e.target.value})}>{['Easy','Moderate','Hard','Very Hard','Failed'].map(v=><option key={v}>{v}</option>)}</select></label><label>Notes<input aria-label={label+' note'} value={s.notes} placeholder="What changed or how it felt" onChange={e=>onPatch({notes:e.target.value})}/></label><button className="text-button" onClick={onDelete}>Remove set {index+1}</button></details>
 </div>;
}
