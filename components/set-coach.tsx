'use client';
import {useCoachMemory} from './coach-memory';
import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {Data,Workout,Exercise,SetLog} from '@/lib/training';
import {nextSetAdvice} from '@/lib/adaptive-coach';
export function SetCoach({data,workout,exercise}:{data:Data;workout:Workout;exercise:Exercise}){
 useCoachMemory('set:'+workout.id);const [error,setError]=useState(''),[saving,setSaving]=useState(false);
 const [dismissed,setDismissed]=useState('');const advice=nextSetAdvice(data,workout,exercise);if(!advice||data.profile?.useStyle==='Just log workouts')return null;
 const key=JSON.stringify(advice);if(dismissed===key)return null;
 const remaining=workout.entries.find(e=>e.exerciseId===exercise.id)?.sets.filter(s=>s.status==='pending').length||1;
 const next={...data,workouts:data.workouts.map(w=>w.id===workout.id?{...w,entries:w.entries.map(e=>e.exerciseId===exercise.id?{...e,sets:e.sets.map(s=>(s.id===advice.setId||advice.applyToRemaining&&s.status==='pending')?{...s,weight:advice.weight,reps:advice.reps,targetWeight:advice.weight,targetReps:advice.reps}:s)}:e)}:w)};
 async function apply(){setSaving(true);setError('');try{const saved=await new Promise<boolean>(resolve=>window.dispatchEvent(new CustomEvent('stride:apply-coach-change',{detail:{action:'set',before:data,next,label:'Next set · '+exercise.name,resolve}})));if(saved)setDismissed(key);else setError('The target was not saved. Try again.')}catch(e){setError(e instanceof Error?e.message:'The target was not saved. Try again.')}finally{setSaving(false)}}
 return <div className="set-coach" aria-live="polite"><div><Sparkles size={17}/><strong>Coach · Next set</strong></div><p>{advice.reason}</p><strong>{advice.weight} lb × {advice.reps} reps</strong>{advice.applyToRemaining&&remaining>1&&<span className="muted">Updates all {remaining} remaining sets for this exercise.</span>}<div className="button-group">{advice.changed?<><button className="primary" disabled={saving} onClick={()=>void apply()}>{saving?'Saving…':advice.applyToRemaining&&remaining>1?'Apply to remaining sets':'Apply to next set'}</button><button className="text-button" disabled={saving} onClick={()=>setDismissed(key)}>Keep my target</button></>:<span className="muted">Your next target is on track.</span>}</div>{error&&<p role="alert">{error}</p>}</div>
}
