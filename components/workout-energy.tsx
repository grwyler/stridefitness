'use client';
import {useMemo,useState} from 'react';
import {Flame} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import type {BodyCheckIn} from '@/lib/body-measurements';
import type {Workout} from '@/lib/training';
import {estimateWorkoutCalories,intensityFromDifficulty,intensityMet,latestWeight,WorkoutIntensity} from '@/lib/workout-energy';

export type EnergyResult={durationMinutes:number;caloriesBurned:number;calorieSource:'estimate'|'manual';energyMet:number;energyWeightLb:number};

export function WorkoutEnergyButton({workout,measurements,onSave,canOpen}:{workout:Workout;measurements?:BodyCheckIn[];onSave:(result:EnergyResult)=>void;canOpen?:()=>boolean}){
 const measuredWeight=latestWeight(measurements,workout.date);
 const elapsed=Math.round((Date.now()-new Date(workout.date).getTime())/60000);
 const initialDuration=workout.durationMinutes??(elapsed>=10&&elapsed<=180?Math.round(elapsed/5)*5:60);
 const initialIntensity=(workout.energyMet===intensityMet.Light?'Light':workout.energyMet===intensityMet.Vigorous?'Vigorous':intensityFromDifficulty(workout.difficulty)) as WorkoutIntensity;
 const [open,setOpen]=useState(false),[duration,setDuration]=useState(String(initialDuration)),[weight,setWeight]=useState(String(workout.energyWeightLb??measuredWeight??'')),[intensity,setIntensity]=useState<WorkoutIntensity>(initialIntensity),[manual,setManual]=useState(workout.calorieSource==='manual'?String(workout.caloriesBurned||''):''),[error,setError]=useState('');
 const estimate=useMemo(()=>estimateWorkoutCalories(Number(weight),Number(duration),intensity),[weight,duration,intensity]);
 function show(){if(canOpen&&!canOpen())return;setDuration(String(workout.durationMinutes??(elapsed>=10&&elapsed<=180?Math.round(elapsed/5)*5:60)));setWeight(String(workout.energyWeightLb??measuredWeight??''));setIntensity(initialIntensity);setManual(workout.calorieSource==='manual'?String(workout.caloriesBurned||''):'');setError('');setOpen(true)}
 return <><button type="button" className={workout.completed?'secondary':'primary'} onClick={show}><Flame size={18}/>{workout.completed?'Edit calories burned':'Finish workout'}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="app-dialog energy-dialog"><DialogHeader><DialogTitle>{workout.completed?'Workout calories':'Finish and estimate calories'}</DialogTitle><DialogDescription>Stride estimates exercise calories from your weight, workout time, and intensity. You can correct the result.</DialogDescription></DialogHeader><form onSubmit={e=>{e.preventDefault();const minutes=Number(duration),pounds=Number(weight),override=manual.trim()===''?null:Number(manual);if(!Number.isFinite(minutes)||minutes<5||minutes>360||!Number.isFinite(pounds)||pounds<=0||override!==null&&(!Number.isFinite(override)||override<0)){setError('Enter a duration from 5–360 minutes, your current weight, and a valid calorie amount.');return}onSave({durationMinutes:minutes,caloriesBurned:override??estimate,calorieSource:override===null?'estimate':'manual',energyMet:intensityMet[intensity],energyWeightLb:pounds});setOpen(false)}}><div className="form-grid"><label>Workout time · min<input type="number" inputMode="numeric" min="5" max="360" step="1" value={duration} onChange={e=>setDuration(e.target.value)}/></label><label>Body weight · lb<input type="number" inputMode="decimal" min="1" step="any" value={weight} placeholder="Required" onChange={e=>setWeight(e.target.value)}/>{measuredWeight!==null&&<small>Latest body check-in: {measuredWeight} lb</small>}</label></div><label>Workout intensity<Select value={intensity} onValueChange={v=>setIntensity(v as WorkoutIntensity)}><SelectTrigger aria-label="Workout intensity"><SelectValue/></SelectTrigger><SelectContent>{(['Light','Moderate','Vigorous'] as const).map(v=><SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select></label><div className="energy-estimate"><span>Estimated exercise calories</span><strong>{estimate||'—'} <small>kcal</small></strong><p>Based on a {intensity.toLowerCase()} resistance-training estimate. Actual burn can vary.</p></div><details className="energy-override"><summary>Use a different calorie number</summary><label>Calories burned<input type="number" inputMode="numeric" min="0" step="1" value={manual} placeholder={estimate?String(estimate):'0'} onChange={e=>setManual(e.target.value)}/></label></details>{error&&<p className="plan-error" role="alert">{error}</p>}<button className="primary full">{workout.completed?'Save calories':'Finish workout'}</button></form></DialogContent></Dialog></>;
}

export function WorkoutEnergySummary({workout}:{workout:Workout}){
 if(!workout.completed||workout.caloriesBurned===undefined)return null;
 return <div className="workout-energy-summary"><Flame size={18}/><div><strong>{workout.caloriesBurned.toLocaleString()} kcal burned</strong><span>{workout.durationMinutes} min · {workout.calorieSource==='manual'?'Entered manually':'Estimated'}</span></div></div>;
}
