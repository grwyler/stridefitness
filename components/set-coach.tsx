'use client';
import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {Data,Workout,Exercise,SetLog} from '@/lib/training';
import {nextSetAdvice} from '@/lib/adaptive-coach';
export function SetCoach({data,workout,exercise,onApply}:{data:Data;workout:Workout;exercise:Exercise;onApply:(id:string,patch:Partial<SetLog>)=>void}){
 const [dismissed,setDismissed]=useState('');const advice=nextSetAdvice(data,workout,exercise);if(!advice)return null;
 const key=JSON.stringify(advice);if(dismissed===key)return null;
 return <div className="set-coach" aria-live="polite"><div><Sparkles size={17}/><strong>Coach · Next set</strong></div><p>{advice.reason}</p><strong>{advice.weight} lb × {advice.reps} reps</strong><div className="button-group">{advice.changed?<><button className="secondary" onClick={()=>onApply(advice.setId,{weight:advice.weight,reps:advice.reps,targetWeight:advice.weight,targetReps:advice.reps})}>Use this target</button><button className="text-button" onClick={()=>setDismissed(key)}>Keep my target</button></>:<span className="muted">Your next target is on track.</span>}</div></div>
}
