'use client';
import {useEffect,useRef,useState} from 'react';
import {Sparkles,Send,Loader2,ArrowRight} from 'lucide-react';
import {AIConnection} from '@/components/ai-connection';
import {Data} from '@/lib/training';
import {GeneratedPlan,PlanMessage,planSchema} from '@/lib/plan';
export type PlannerState={messages:PlanMessage[];plan:GeneratedPlan|null;ids:string[]};
export function PlanChat({data,state,onApply,onReset,onView}:{data:Data;state:PlannerState;onApply:(plan:GeneratedPlan,messages:PlanMessage[])=>void;onReset:()=>void;onView:()=>void}){
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);const controller=useRef<AbortController|null>(null);const log=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[state.messages,busy,error]);
 async function send(){
  if(pending.current||!input.trim())return;
  pending.current=true;setBusy(true);setError('');
  const messages:PlanMessage[]=[...state.messages.slice(-10),{role:'user',content:input.trim()}];
  controller.current=new AbortController();const timeout=setTimeout(()=>controller.current?.abort(),70000);
  try{
   const response=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,exercises:data.exercises.map(({id,name,category})=>({id,name,category})),currentPlan:state.plan}),signal:controller.current.signal});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to create your plan. Try again.');
   const plan=planSchema.parse(body);onApply(plan,[...messages,{role:'assistant',content:plan.message}]);setInput('');
  }catch(e){setError(e instanceof Error&&e.name==='AbortError'?'That took too long. Your existing workouts are unchanged. Please try again.':e instanceof Error?e.message:'Unable to create your plan. Please try again.')}
  finally{clearTimeout(timeout);pending.current=false;setBusy(false)}
 }
 return <section className="panel plan-chat"><div className="section-head"><div><h2><Sparkles size={20}/> Build a plan with AI</h2><p>Describe your goals, equipment, and time. Your plan becomes editable workout templates.</p></div><div className="plan-header-actions"><AIConnection/>{state.messages.length>0&&<button disabled={busy} className="text-button" onClick={()=>{onReset();setError('');setInput('')}}>New plan</button>}</div></div>
 {state.messages.length>0&&<div className="plan-messages" ref={log} role="log" aria-label="Workout planning conversation">{state.messages.map((m,i)=><div key={i} className={'plan-message '+m.role}><strong>{m.role==='user'?'You':'Stride'}</strong><p>{m.content}</p></div>)}</div>}
 {state.ids.length>0&&<div className="plan-saved"><span>{state.ids.filter(id=>data.templates.some(t=>t.id===id)).length} workout templates created</span><button className="text-button" onClick={onView}>View templates <ArrowRight size={16}/></button></div>}
 <form onSubmit={e=>{e.preventDefault();void send()}}><label htmlFor="plan-request">{state.plan?'What would you like to change?':'What would you like to train for?'}</label><textarea id="plan-request" rows={3} maxLength={4000} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder="For example: Build a 3-day strength plan with a barbell and dumbbells, about 45 minutes per workout."/><div className="plan-submit"><p>{state.plan?'Changes update the templates from this conversation.':'Include any exercises you want to avoid.'}</p><button className="primary" disabled={busy||!input.trim()}>{busy?<Loader2 className="plan-spin" size={18}/>:<Send size={18}/>} {busy?'Creating…':state.plan?'Update plan':'Send'}</button></div>{busy&&<p role="status">Putting your plan together…</p>}{error&&<p className="plan-error" role="alert">{error}</p>}</form></section>
}
