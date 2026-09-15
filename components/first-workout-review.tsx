'use client';
import {CheckCircle2} from 'lucide-react';
import {recommend,type Data,type Workout} from '@/lib/training';
export function FirstWorkoutReview({data,workout}:{data:Data;workout:Workout}){
 const sets=workout.entries.flatMap(e=>e.sets),completed=sets.filter(s=>s.status==='completed'||s.status==='modified').length,failed=sets.filter(s=>s.status==='failed').length;
 const targets=workout.entries.slice(0,3).flatMap(entry=>{const exercise=data.exercises.find(e=>e.id===entry.exerciseId);return exercise?[{exercise,target:recommend(data,exercise)}]:[]});
 return <section className="panel first-workout-learning"><span className="eyebrow"><CheckCircle2 size={16}/> YOUR FIRST SESSION</span><h2>You’ve given Stride a starting point.</h2><p>{completed} {completed===1?'set':'sets'} completed{failed?` · ${failed} attempted ${failed===1?'set fell':'sets fell'} short`:''}. These logged loads and reps now inform your next targets.</p><ul>{targets.map(({exercise,target})=><li key={exercise.id}><strong>{exercise.name}: {target.weight>0?`${target.weight} lb × `:''}{target.reps} reps</strong><br/>{target.why}</li>)}</ul><p className="muted">One session establishes a baseline, not a trend. Adjust for how you feel, and record effort or discomfort when it matters.</p></section>
}
