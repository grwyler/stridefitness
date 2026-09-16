'use client';
import {useState} from 'react';
import {Flame} from 'lucide-react';

export function AdminWorkoutCalories({userId,workouts}:{userId:string;workouts:{id:string;name:string}[]}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(!workouts.length)return null;
 async function estimate(){setBusy(true);setMessage('');try{const response=await fetch('/api/admin/workout-calories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,workoutIds:workouts.map(workout=>workout.id)})}),body=await response.json() as {error?:string;count?:number};if(!response.ok)throw new Error(body.error||'The workout calories could not be saved.');setMessage(`${body.count} workout${body.count===1?'':'s'} updated.`);setTimeout(()=>window.location.reload(),700)}catch(error){setMessage(error instanceof Error?error.message:'The workout calories could not be saved.')}finally{setBusy(false)}}
 return <div className="button-group"><button className="secondary" disabled={busy} onClick={()=>void estimate()}><Flame size={15}/> {busy?'Estimating…':`Estimate calories · ${workouts.length} workouts`}</button>{message&&<p role="status">{message}</p>}</div>;
}
