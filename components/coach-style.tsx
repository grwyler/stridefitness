'use client';
import {useState} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {coachStyleNames,coachStyles,type CoachStyle,type CoachIntensity} from '@/lib/coach-style';
import {useCoachMemory} from './coach-memory';
export function CoachStylePicker({style,intensity,onChange,disabled=false}:{style?:CoachStyle|null;intensity?:CoachIntensity|null;onChange:(style:CoachStyle,intensity:CoachIntensity)=>void;disabled?:boolean}){
 const chosen=style??'Calm Strategist',level=intensity??'Medium';
 return <div className="coach-style-picker"><label>Coaching style<select disabled={disabled} value={chosen} onChange={e=>onChange(e.target.value as CoachStyle,level)}>{coachStyleNames.map(name=><option key={name}>{name}</option>)}</select></label><p>{coachStyles[chosen].description}</p><div className="coach-style-sample"><span>VOICE PREVIEW · AFTER A MISSED SESSION</span><blockquote>{coachStyles[chosen].sample}</blockquote></div><label>How strongly should the personality come through?<select disabled={disabled} value={level} onChange={e=>onChange(chosen,e.target.value as CoachIntensity)}><option value="Low">Low · understated</option><option value="Medium">Medium · natural</option><option value="High">High · distinctive</option></select></label><small>This changes your coach’s voice, not your workout difficulty or targets. You can change it anytime.</small></div>;
}
export function CoachStyleSettings(){
 const {data,applyNow}=useCoachMemory('style');
 const [open,setOpen]=useState(false),[style,setStyle]=useState<CoachStyle>('Calm Strategist'),[intensity,setIntensity]=useState<CoachIntensity>('Medium'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function show(){setStyle(data.profile?.coachStyle??'Calm Strategist');setIntensity(data.profile?.coachIntensity??'Medium');setMessage('');setOpen(true)}
 async function save(){if(!data.profile||busy)return;setBusy(true);setMessage('');try{const saved=await applyNow('offer',{...data,profile:{...data.profile,coachStyle:style,coachIntensity:intensity}},'Coaching style');setMessage(saved?'Coaching style saved. Your next coach reply will use it.':'Your style was not saved. Please retry.')}catch{setMessage('Your style could not be saved. Please retry.')}finally{setBusy(false)}}
 return <><button className="text-button coach-style-trigger" onClick={show} aria-label="Change coaching style"><SlidersHorizontal size={17}/><span>Coach style</span></button><Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Choose your coach’s voice</DialogTitle><DialogDescription>The same attention to your training, delivered your way.</DialogDescription></DialogHeader><CoachStylePicker style={style} intensity={intensity} disabled={busy} onChange={(s,i)=>{setStyle(s);setIntensity(i);setMessage('')}}/><button className="primary full" disabled={busy||!data.profile} onClick={()=>void save()}>{busy?'Saving…':'Save coaching style'}</button>{message&&<p role="status">{message}</p>}</DialogContent></Dialog></>;
}
