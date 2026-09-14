'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,ArrowRight,Loader2} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {useCoachMemory} from './coach-memory';
import {applyChanges} from '@/lib/account-operations';
import {localDay} from '@/lib/nutrition';
import {shiftDay,targetSchema,type WeeklyReview,type ReviewEvidence} from '@/lib/weekly-review';
import {responseError} from '@/lib/api-responses';
import type {Target} from '@/lib/training';

type ResponseBody={accountId:string;review:WeeklyReview|null};
export function WeeklyReviewPanel({sync,onWorkout}:{sync:()=>Promise<boolean>;onWorkout:(id:string)=>void}){
 const {data,stage,review:showOperations}=useCoachMemory('weekly');
 const latest=useRef(data);latest.current=data;
 const [open,setOpen]=useState(false),[result,setResult]=useState<WeeklyReview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false),[draft,setDraft]=useState<Target|null>(null),[record,setRecord]=useState<ReviewEvidence|null>(null),[loaded,setLoaded]=useState(false);
 const identity=useRef(''),requestId=useRef('');
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 async function load(){setError('');setBusy(true);try{const response=await fetch('/api/weekly-review',{cache:'no-store'});const body:ResponseBody=await response.json();if(!response.ok)throw new Error(responseError(body,'Your review could not be loaded.'));if(!mounted.current)return;identity.current=body.accountId;setResult(body.review);setDraft(body.review?.prepared?.target||body.review?.recommendation.target||null);setLoaded(true)}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Please retry.')}finally{if(mounted.current)setBusy(false)}}
 useEffect(()=>{void load()},[]);
 async function request(payload:unknown){const response=await fetch('/api/weekly-review',{method:'POST',headers:{'Content-Type':'application/json','X-Stride-Account':identity.current},body:JSON.stringify(payload)});const body:ResponseBody=await response.json();if(!response.ok)throw new Error(responseError(body,'Your review could not be updated.'));if(body.accountId!==identity.current)throw new Error('Your account changed. Reopen the review.');return body.review!}
 async function generate(){setBusy(true);setError('');try{if(!await sync())throw new Error('Your latest edits still need to save. Return to Stride to check account saving, then retry.');if(!requestId.current)requestId.current=crypto.randomUUID();const next=await request({intent:'generate',id:requestId.current,day:localDay()});requestId.current='';if(mounted.current){setResult(next);setDraft(next.recommendation.target||null);setEditing(false)}}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Please retry.')}finally{if(mounted.current)setBusy(false)}}
 async function prepare(){if(!result||!draft)return;setBusy(true);setError('');try{const target=targetSchema.parse(draft);if(!await sync())throw new Error('Finish syncing your existing edits before reviewing this change.');const next=await request({intent:'prepare',id:result.id,target});if(!mounted.current)return;setResult(next);if(next.receipt)return;const operation=next.prepared?.operation;if(!operation)throw new Error('No proposed change was returned.');const before=latest.current,after=applyChanges(before,operation.payload);stage(operation.action,before,after,'Weekly Review · next workout target',operation.id);setOpen(false);showOperations()}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'The proposed target needs attention.')}finally{if(mounted.current)setBusy(false)}}
 async function feedback(value:WeeklyReview['feedback']){if(!result)return;setBusy(true);setError('');try{const next=await request({intent:'feedback',id:result.id,feedback:value});if(mounted.current)setResult(next)}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Your feedback could not be kept.')}finally{if(mounted.current)setBusy(false)}}
 const due=!result||localDay()>=shiftDay(result.day,7);
 const evidence=result?.evidence.filter(e=>result.recommendation.evidenceKeys.includes(e.key))||[];
 return <section className="panel weekly-entry"><div><h2><CalendarDays size={20}/> Weekly Review</h2><p>{loaded?(due?'A useful next step from your recent records.':`Last reviewed ${result?.day} · next review ${result?shiftDay(result.day,7):''}`):'A useful next step from your recent records.'}</p></div><button className="secondary" onClick={()=>{setOpen(true);setEditing(false);void load()}}>Open review <ArrowRight size={16}/></button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="app-dialog weekly-review"><DialogHeader><DialogTitle>Weekly Review</DialogTitle><DialogDescription>{result?`${result.start} – ${result.day} · based on saved records`:'Your last seven days, with earlier records for comparison.'}</DialogDescription></DialogHeader>
 {busy&&<p role="status"><Loader2 className="plan-spin" size={16}/> {result?'Checking your saved records…':'Opening your review…'}</p>}
 {error&&<p role="alert" className="plan-error">{error}</p>}
 {!result&&!busy&&<div><p>Find one useful focus from what you actually logged. Nothing in your training changes until you review and apply it.</p><button className="primary" disabled={!identity.current} onClick={()=>void generate()}>Review my week</button>{!loaded&&<button className="secondary" onClick={()=>void load()}>Retry loading</button>}</div>}
 {result&&<>
 {due&&<p className="notice">A new weekly review is due. Review your latest records when you’re ready.</p>}
 <section><h3>What happened</h3><p>{result.summary}</p></section>
 <section><h3>What stands out</h3><p>{result.standout}</p></section>
 <section className="weekly-focus"><h3>Recommended next step</h3><p><strong>{result.recommendation.text}</strong></p>{result.recommendation.target&&<p className="muted">This sets your next-workout target for one exercise. It does not change logged sets. Stride clears the override when you finish a workout using that exercise.</p>}
 {result.receipt?<p role="status">Saved to your account</p>:result.feedback!=='open'?<><p role="status">{result.feedback==='not_now'?'Not now — kept with this review.':'Doesn’t fit — kept with this review.'}</p><button className="text-button" disabled={busy} onClick={()=>void feedback('open')}>Reconsider</button></>:<>
 {editing&&draft&&<fieldset disabled={busy}><legend>Edit your next target</legend><div className="weekly-target-fields">{(['weight','reps','sets'] as const).map(field=><label key={field}>{field==='weight'?'Weight · lb':field==='reps'?'Reps':'Sets'}<input type="number" min={field==='weight'?0:1} max={field==='weight'?2000:field==='reps'?100:20} step={field==='weight'?0.5:1} value={draft[field]} onChange={e=>setDraft({...draft,[field]:Number(e.target.value)})}/></label>)}</div></fieldset>}
 <div className="button-group">{draft&&<button className="primary" disabled={busy} onClick={()=>void prepare()}>{result.prepared?'Open proposed change':'Review & apply'}</button>}{draft&&!result.prepared&&<button className="secondary" disabled={busy} onClick={()=>setEditing(!editing)}>{editing?'Done editing':'Edit before applying'}</button>}<button className="text-button" disabled={busy||!!result.prepared} onClick={()=>void feedback('not_now')}>Not now</button></div><button className="text-button" disabled={busy||!!result.prepared} onClick={()=>void feedback('does_not_fit')}>This doesn’t fit my situation</button>{result.prepared&&<p className="muted">This change is ready for review in Coach changes. Use its Discard button if you don’t want to apply it.</p>}
 </>}</section>
 <section><h3>Why</h3><p>{result.recommendation.why}</p><div className="weekly-evidence">{evidence.map(e=><button className="secondary" key={e.key} onClick={()=>setRecord(e)}>{e.title} · {e.date}<ArrowRight size={14}/></button>)}</div></section>
 {result.keepDoing&&<section><h3>Keep doing</h3><p>{result.keepDoing}</p></section>}
 <details><summary>What’s missing or incomplete</summary><ul>{result.coverage.map((text,i)=><li key={i}>{text}</li>)}</ul></details>
 {result.observations.length>0&&<details><summary>Activities, goals & measurements</summary><ul>{result.observations.map((text,i)=><li key={i}>{text}</li>)}</ul><div className="weekly-evidence">{result.evidence.filter(e=>e.kind!=='workout').map(e=><button key={e.key} className="text-button" onClick={()=>setRecord(e)}>{e.title} · {e.date}</button>)}</div></details>}
 <details><summary>Previous recommendations</summary>{result.prior.length?result.prior.map(p=><div key={p.reviewId}><p><strong>{p.recommendation}</strong></p><p>{p.detail}</p>{p.evidence.map(e=><button key={e.key} className="text-button" onClick={()=>setRecord(e)}>{e.title} · {e.date}</button>)}</div>):<p>No earlier weekly review is available yet. Future reviews will compare this recommendation with subsequent saved records and confirmed changes.</p>}</details>
 <button className="secondary" disabled={busy} onClick={()=>void generate()}>Review latest records</button><small className="muted">One focus at a time. {result.selection==='ai'?'AI selected among evidence-backed options.':'Selected using Stride’s recorded-performance rules.'}</small>
 </>}
 </DialogContent></Dialog>
 <Dialog open={!!record} onOpenChange={o=>{if(!o)setRecord(null)}}><DialogContent className="app-dialog weekly-record"><DialogHeader><DialogTitle>{record?.title}</DialogTitle><DialogDescription>{record?.date} · record used for this review</DialogDescription></DialogHeader><p>{record?.detail}</p>{record?.kind==='workout'&&<button className="secondary" onClick={()=>{const id=record.recordId;setRecord(null);setOpen(false);onWorkout(id)}}>Open workout</button>}<p className="muted">Evidence reflects the saved record when this review was generated. Review latest records after corrections.</p></DialogContent></Dialog>
 </section>;
}
