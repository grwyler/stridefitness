"use client";
import {useEffect,useState} from "react";
import {ArrowRight,CheckCircle2,Dumbbell,History,Sparkles} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";

const tour=[
 {icon:Dumbbell,title:"Log training your way",text:"Start with a coach-built plan, a saved template, or a blank workout. Every set stays editable."},
 {icon:Sparkles,title:"Ask for useful changes",text:"Your coach can explain targets and propose changes. Nothing changes in your account until you review and apply it."},
 {icon:History,title:"Learn from what happened",text:"As you build history, Weekly Review finds one evidence-based next step—or tells you when staying the course makes sense."},
];

export function FirstRunCoach({onPlan,onWorkout,onExplore}:{onPlan:()=>void;onWorkout:()=>void;onExplore:()=>void}){
 const [ai,setAi]=useState<"checking"|"enabled"|"off">("checking"),[open,setOpen]=useState(false),[step,setStep]=useState(0);
 useEffect(()=>{const controller=new AbortController();fetch("/api/ai-connection",{cache:"no-store",credentials:"same-origin",signal:controller.signal}).then(async response=>{const body=await response.json() as {connected?:boolean};if(!controller.signal.aborted)setAi(response.ok&&body.connected?"enabled":"off")}).catch(()=>{if(!controller.signal.aborted)setAi("off")});return()=>controller.abort()},[]);
 const item=tour[step],Icon=item.icon;
 return <>
  <section className="panel first-run-coach" aria-labelledby="first-run-title">
   <div className="first-run-copy"><span className="first-run-icon"><Sparkles size={22}/></span><div><span className="eyebrow">WELCOME TO STRIDE</span><h2 id="first-run-title">{ai==="enabled"?"Hi — I’m your Stride coach.":"Start wherever feels right."}</h2><p>{ai==="enabled"?"I can help build your first workout, answer questions, and turn what you log into practical next steps. You stay in control of every change.":"Log your own training, create a reusable workout, or connect AI whenever you want coaching."}</p></div></div>
   <div className="first-run-actions">{ai==="enabled"&&<button className="primary" onClick={onPlan}>Build a plan with me <ArrowRight size={17}/></button>}<button className={ai==="enabled"?"secondary":"primary"} onClick={onWorkout}>Log my own workout</button><button className="text-button" onClick={()=>{setStep(0);setOpen(true)}}>Show me around</button></div>
   <button className="first-run-explore text-button" onClick={onExplore}>Explore on my own</button>
  </section>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="app-dialog first-run-tour"><DialogHeader><DialogTitle>A quick look at Stride</DialogTitle><DialogDescription>Three things worth knowing. You can leave at any time.</DialogDescription></DialogHeader><div className="tour-progress" aria-label={`Tour step ${step+1} of ${tour.length}`}>{tour.map((_,i)=><span key={i} className={i<=step?"active":""}/>)}</div><div className="tour-step"><span><Icon size={24}/></span><small>{step+1} of {tour.length}</small><h3>{item.title}</h3><p>{item.text}</p></div><div className="tour-actions">{step>0&&<button className="secondary" onClick={()=>setStep(step-1)}>Back</button>}<button className="primary" onClick={()=>{if(step<tour.length-1)setStep(step+1);else setOpen(false)}}>{step<tour.length-1?<>Next <ArrowRight size={16}/></>:<>Done <CheckCircle2 size={16}/></>}</button></div>{step===0&&<button className="text-button" onClick={()=>setOpen(false)}>Skip tour</button>}</DialogContent></Dialog>
 </>;
}
