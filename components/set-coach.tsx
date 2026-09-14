'use client';
import {useCoachMemory} from './coach-memory';
import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {Data,Workout,Exercise,SetLog} from '@/lib/training';
import {nextSetAdvice} from '@/lib/adaptive-coach';
export function SetCoach({data,workout,exercise}:{data:Data;workout:Workout;exercise:Exercise}){
 const {stage}=useCoachMemory('set:'+workout.id);const [error,setError]=useState('');
 const [dismissed,setDismissed]=useState('');const advice=nextSetAdvice(data,workout,exercise);if(!advice||data.profile?.useStyle==='Just log workouts')return null;
 const key=JSON.stringify(advice);if(dismissed===key)return null;
 return <div className="set-coach" aria-live="polite"><div><Sparkles size={17}/><strong>Coach · Next set</strong></div><p>{advice.reason}</p><strong>{advice.weight} lb × {advice.reps} reps</strong><div className="button-group">{advice.changed?<><button className="secondary" onClick={()=>{try{stage('set',data,{...data,workouts:data.workouts.map(w=>w.id===workout.id?{...w,entries:w.entries.map(e=>e.exerciseId===exercise.id?{...e,sets:e.sets.map(s=>s.id===advice.setId?{...s,weight:advice.weight,reps:advice.reps,targetWeight:advice.weight,targetReps:advice.reps}:s)}:e)}:w)},'Next set · '+exercise.name);setDismissed(key)}catch(e){setError((e as Error).message)}}}>Review this target</button><button className="text-button" onClick={()=>setDismissed(key)}>Keep my target</button></>:<span className="muted">Your next target is on track.</span>}</div>{error&&<p role="alert">{error}</p>}</div>
}
