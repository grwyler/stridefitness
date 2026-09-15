'use client';
import {useEffect,useRef,useState} from 'react';
import {Sparkles,Send,Loader2,X} from 'lucide-react';
import {CoachLauncher} from './coach-launcher';
import {CoachConversation} from './coach-conversation';
import {Data,Template} from '@/lib/training';
import {GeneratedPlan,planSchema,coachingContext,applyProgressProposal} from '@/lib/plan';
import {applyTemplateEdit} from '@/lib/template-coach';
import {useCoachMemory} from './coach-memory';
import {CoachSaveOffer} from './coach-save-offer';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {AIConnection} from './ai-connection';
export function TemplateCoach({data,selected,onSelect,open,onOpenChange}:{data:Data;selected:string;onSelect:(id:string)=>void;open:boolean;onOpenChange:(open:boolean)=>void}){
 const {messages,setMessages,setOffer,change,stage}=useCoachMemory('templates');
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [proposal,setProposal]=useState<{before:Template;plan:GeneratedPlan}|null>(null);
 const latest=useRef(data);latest.current=data;
 const inputRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{setProposal(null);setError('')},[selected]);
 useEffect(()=>{if(open)inputRef.current?.focus({preventScroll:true})},[selected,open]);
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
   if(plan.progress)stage('progress',data,applyProgressProposal(data,plan.progress),'Goals, nutrition & activities');setOffer(plan.saveUpdates?{...plan.saveUpdates,...(plan.progress?.goal?{goal:null}:{}),...(plan.progress?.nutrition?{nutrition:null}:{})}:null);
   if(plan.workouts.length){
    if(!before)throw new Error('Select the template you want to adjust, or use Create a new plan below.');
    applyTemplateEdit(latest.current,before,plan);
    stage('template',latest.current,applyTemplateEdit(latest.current,before,plan),'Template · '+plan.workouts[0].name);
   }
  }catch(e){setError(e instanceof Error?e.message:'Your coach could not respond.')}finally{setBusy(false)}
 }
 if(!open)return <CoachLauncher hint="Ask about your plan or adjust a saved workout." hasMessages={messages.length>0} onOpen={()=>onOpenChange(true)}/>;
 return <section id="template-coach" className="panel progress-coach">
  <div className="section-head"><div><h2><Sparkles size={20}/> Your coach</h2><p>Ask a question, get advice, or adjust a saved template.</p></div><div className="plan-header-actions"><AIConnection/><button className="icon-button" aria-label="Close coach" disabled={busy} onClick={()=>onOpenChange(false)}><X size={18}/></button></div></div>
  <div className="coach-context"><label htmlFor="coach-template">Talking about</label><Select value={selected||'general'} disabled={busy} onValueChange={value=>onSelect(value==='general'?'':value)}><SelectTrigger id="coach-template"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="general">General training questions</SelectItem>{data.templates.map(t=><SelectItem value={t.id} key={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
  <CoachConversation messages={messages} testWorkspace={data.user?.id==='test-user'}/>
  <CoachSaveOffer area="templates"/>
  <form onSubmit={e=>{e.preventDefault();void send()}}><label htmlFor="template-question">How can I help?</label><textarea ref={inputRef} id="template-question" rows={2} maxLength={4000} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder={selected?'Explain this workout, swap an exercise, or adjust the sets…':'Ask about your training, or choose a template above to adjust it…'}/><button className="primary" disabled={busy||!input.trim()}>{busy?<Loader2 size={17}/>:<Send size={17}/>} {busy?'Thinking…':'Send'}</button>{error&&<p className="plan-error" role="alert">{error}</p>}</form>
 </section>
}
