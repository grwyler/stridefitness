'use client';
import {useEffect,useRef,useState} from 'react';
import {Sparkles,Send,Loader2} from 'lucide-react';
import {Data,Template} from '@/lib/training';
import {GeneratedPlan,planSchema,coachingContext} from '@/lib/plan';
import {applyTemplateEdit} from '@/lib/template-coach';
import {useCoachMemory} from './coach-memory';
import {CoachSaveOffer} from './coach-save-offer';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {AIConnection} from './ai-connection';
export function TemplateCoach({data,selected,onSelect}:{data:Data;selected:string;onSelect:(id:string)=>void}){
 const {messages,setMessages,setOffer,change}=useCoachMemory('templates');
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [proposal,setProposal]=useState<{before:Template;plan:GeneratedPlan}|null>(null);
 const latest=useRef(data);latest.current=data;
 const inputRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{setProposal(null);setError('');if(selected)inputRef.current?.focus({preventScroll:true})},[selected]);
 async function send(){
  if(busy||!input.trim())return;
  const before=data.templates.find(t=>t.id===selected);
  const next=[...messages,{role:'user' as const,content:before?`Regarding my template “${before.name}”: ${input.trim()}`:input.trim()}];
  setBusy(true);setError('');setProposal(null);setMessages(next);
  try{
   const response=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateEdit:!!before,messages:next.slice(-10),exercises:data.exercises.map(({id,name,category})=>({id,name,category})),currentPlan:before?{message:'Selected saved template',workouts:[before],progress:null,saveUpdates:null}:null,training:coachingContext(data)})});
   const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||'Your coach could not respond.');
   const plan=planSchema.parse(body);
   setMessages([...next,{role:'assistant',content:plan.message}]);setInput('');
   setOffer(plan.progress?{profile:plan.saveUpdates?.profile||[],goal:plan.progress.goal,nutrition:plan.progress.nutrition}:plan.saveUpdates||null);
   if(plan.workouts.length){
    if(!before)throw new Error('Select the template you want to adjust, or use Create a new plan below.');
    applyTemplateEdit(latest.current,before,plan);
    setProposal({before,plan});
   }
  }catch(e){setError(e instanceof Error?e.message:'Your coach could not respond.')}finally{setBusy(false)}
 }
 function apply(){
  if(!proposal)return;
  try{applyTemplateEdit(latest.current,proposal.before,proposal.plan)}catch(e){setError((e as Error).message);setProposal(null);return}
  change(current=>{
   let next=current,message='';
   try{next=applyTemplateEdit(current,proposal.before,proposal.plan);message=`Saved changes to ${proposal.plan.workouts[0].name}.`}catch{message='The template changed before saving. Please ask again using its latest version.'}
   return {...next,coachChats:{...next.coachChats,templates:[...(next.coachChats?.templates||[]),{role:'assistant' as const,content:message}].slice(-200)}}
  });
  setProposal(null);
 }
 return <section id="template-coach" className="panel progress-coach">
  <div className="section-head"><div><h2><Sparkles size={20}/> Your coach</h2><p>Ask a question, get advice, or adjust a saved template.</p></div><AIConnection/></div>
  <label htmlFor="coach-template">Talking about</label><Select value={selected||'general'} disabled={busy} onValueChange={value=>onSelect(value==='general'?'':value)}><SelectTrigger id="coach-template"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="general">General training questions</SelectItem>{data.templates.map(t=><SelectItem value={t.id} key={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
  {messages.length>0&&<details><summary>Conversation</summary><div className="progress-coach-messages" role="log">{messages.map((m,i)=><div className={'plan-message '+m.role} key={i}><strong>{m.role==='user'?'You':'Stride'}</strong><p>{m.content}</p></div>)}</div></details>}
  {messages.at(-1)?.role==='assistant'&&<div className="plan-message assistant"><p>{messages.at(-1)?.content}</p></div>}
  <CoachSaveOffer area="templates"/>
  {proposal&&<div className="progress-proposal"><strong>Review changes · {proposal.before.name}</strong><b>{proposal.plan.workouts[0].name}</b><p>{proposal.plan.workouts[0].description}</p>{proposal.plan.workouts[0].entries.map(e=><span key={e.exerciseId}>{data.exercises.find(x=>x.id===e.exerciseId)?.name} · {e.sets} × {e.reps}{e.weight!==null?` · ${e.weight} lb`:''}</span>)}<button className="primary" onClick={apply}>Save template changes</button><button className="secondary" onClick={()=>setProposal(null)}>Keep current template</button></div>}
  <form onSubmit={e=>{e.preventDefault();void send()}}><label htmlFor="template-question">How can I help?</label><textarea ref={inputRef} id="template-question" rows={2} maxLength={4000} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder={selected?'Explain this workout, swap an exercise, or adjust the sets…':'Ask about your training, or choose a template above to adjust it…'}/><button className="primary" disabled={busy||!input.trim()}>{busy?<Loader2 size={17}/>:<Send size={17}/>} {busy?'Thinking…':'Send'}</button>{error&&<p className="plan-error" role="alert">{error}</p>}</form>
 </section>
}
