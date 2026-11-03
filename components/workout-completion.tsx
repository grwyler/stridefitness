'use client';

import {ArrowLeft,CalendarDays,CheckCircle2,Dumbbell,Flame,TrendingUp} from 'lucide-react';
import {estimatedOneRepMax} from '@/lib/goals';
import {performedVolume,type Workout} from '@/lib/training';

const attempted=(status:string)=>status==='completed'||status==='modified'||status==='failed';
function durationLabel(seconds:number|undefined,workout:Workout){
 const elapsed=seconds??(workout.completedAt?Math.max(0,Math.floor((Date.parse(workout.completedAt)-Date.parse(workout.date))/1000)):workout.durationMinutes?workout.durationMinutes*60:null);
 if(elapsed===null)return 'Time unavailable';
 if(elapsed<60)return 'Under 1 min';
 const hours=Math.floor(elapsed/3600),minutes=Math.floor(elapsed%3600/60);
 return hours?`${hours} hr ${minutes} min`:`${Math.floor(elapsed/60)} min`;
}

export function WorkoutCompletionReview({workout,week,readyToProgress,populationPercentile,readiness,onBackToToday}:{workout:Workout;week:Workout[];readyToProgress:number;populationPercentile:number|null;readiness:string;onBackToToday:()=>void}){
 const sets=workout.entries.flatMap(entry=>entry.sets).filter(set=>attempted(set.status));
 const reps=sets.reduce((total,set)=>{
  const performedTiers=set.tierActuals?.filter(tier=>attempted(tier.status))||[];
  return total+(performedTiers.length?performedTiers.reduce((sum,tier)=>sum+(tier.actualReps||0),0):set.reps);
 },0);
 const exercises=workout.entries.filter(entry=>entry.sets.some(set=>attempted(set.status))).length;
 const bestEstimate=Math.max(0,...workout.entries.flatMap(entry=>entry.sets.flatMap(set=>{
  const tiers=set.tierActuals?.filter(tier=>attempted(tier.status))||[];
  if(tiers.length)return tiers.filter(tier=>(tier.actualWeight||0)>0&&(tier.actualReps||0)>0).map(tier=>estimatedOneRepMax(tier.actualWeight!,tier.actualReps!));
  return attempted(set.status)&&set.weight>0&&set.reps>0?[estimatedOneRepMax(set.weight,set.reps)]:[];
 })));
 const weekVolume=week.reduce((total,session)=>total+performedVolume(session),0);
 const calorieSessions=week.filter(session=>session.caloriesBurned!==undefined);
 const weekCalories=calorieSessions.reduce((total,session)=>total+(session.caloriesBurned||0),0);

 return <section className="workout-completion" aria-labelledby="workout-completion-title">
  <div className="workout-completion-heading">
   <span className="workout-completion-check"><CheckCircle2 size={24}/></span>
   <div><span className="eyebrow">SESSION COMPLETE</span><h2 id="workout-completion-title">You did the work.</h2><p>{workout.name} is in the books. Here’s what you accomplished.</p></div>
  </div>
  <div className="workout-completion-hero">
   <div><span>WEIGHT MOVED</span><strong>{performedVolume(workout).toLocaleString()} <small>lb</small></strong></div>
   <span className="workout-completion-in">in</span>
   <div><span>WORKOUT TIME</span><strong>{durationLabel(workout.elapsedSeconds,workout)}</strong></div>
  </div>
  <p className="workout-completion-caption">Total recorded load × reps. Every completed tier is included.</p>
  <div className="workout-completion-session-stats" aria-label="Workout details">
   <div><strong>{exercises}</strong><span>exercises</span></div>
   <div><strong>{sets.length}</strong><span>sets attempted</span></div>
   <div><strong>{reps.toLocaleString()}</strong><span>reps logged</span></div>
  </div>
  <div className="workout-completion-progress">
   <div className="workout-completion-section-heading"><div><span className="eyebrow">YOUR TRAINING</span><h3>Progress this week</h3></div><span>{readiness}</span></div>
   <div className="workout-completion-progress-grid">
    <article><span><CalendarDays size={16}/> Workouts</span><strong>{week.length}</strong><small>this week</small></article>
    <article><span><Dumbbell size={16}/> Weekly volume</span><strong>{weekVolume.toLocaleString()}</strong><small>lb logged</small></article>
    <article><span><Flame size={16}/> Exercise calories</span><strong>{calorieSessions.length?weekCalories.toLocaleString():'—'}</strong><small>{calorieSessions.length?`${calorieSessions.length} tracked workout${calorieSessions.length===1?'':'s'}`:'not tracked'}</small></article>
    <article><span><TrendingUp size={16}/> Ready to progress</span><strong>{readyToProgress}</strong><small>exercises</small></article>
    <article><span><TrendingUp size={16}/> Best set estimate</span><strong>{bestEstimate?bestEstimate.toLocaleString():'—'}</strong><small>{bestEstimate?'estimated lb':'no loaded set'}</small></article>
   </div>
   <div className="workout-completion-strength"><span>Strength percentile</span><strong>{populationPercentile===null?'Building your baseline':`${populationPercentile}%`}</strong><small>{populationPercentile===null?'Log all five compound lifts to see this comparison.':'Estimated from your body and strength profile.'}</small></div>
  </div>
  <button className="secondary workout-completion-return" onClick={onBackToToday}><ArrowLeft size={16}/> Back to Today</button>
 </section>;
}
