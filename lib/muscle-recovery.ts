import {fitnessNow} from './fitness-clock';
import type {Data,Exercise} from './training';

export const muscleGroups=['Chest','Shoulders','Triceps','Back','Biceps','Core','Glutes','Quadriceps','Hamstrings','Calves'] as const;
export type MuscleGroup=typeof muscleGroups[number];
export type RecoveryState='Recovering'|'Nearly recovered'|'Likely ready'|'Unknown';
export type MuscleRecovery={group:MuscleGroup;state:RecoveryState;lastTrained:string|null;hoursSince:number|null;directSets:number;secondarySets:number;detail:string};

export function exerciseMuscles(exercise:Pick<Exercise,'name'|'category'>):{primary:MuscleGroup[];secondary:MuscleGroup[]}{
 const text=(exercise.name+' '+exercise.category).toLowerCase();
 const has=(...words:string[])=>words.some(word=>text.includes(word));
 if(has('deadlift','good morning'))return {primary:['Hamstrings','Glutes','Back'],secondary:['Core']};
 if(has('squat','leg press','lunge','split squat','step-up'))return {primary:['Quadriceps','Glutes'],secondary:['Hamstrings','Core']};
 if(has('hamstring','leg curl','romanian'))return {primary:['Hamstrings','Glutes'],secondary:['Back']};
 if(has('calf'))return {primary:['Calves'],secondary:[]};
 if(has('bench','chest','push-up','push up','dip','fly','pec'))return {primary:['Chest'],secondary:['Triceps','Shoulders']};
 if(has('overhead press','shoulder press','lateral raise','front raise','rear delt','upright row'))return {primary:['Shoulders'],secondary:['Triceps']};
 if(has('tricep','skull crusher','extension','pushdown'))return {primary:['Triceps'],secondary:[]};
 if(has('pull-up','pull up','pulldown','row','lat','back'))return {primary:['Back'],secondary:['Biceps']};
 if(has('curl','bicep'))return {primary:['Biceps'],secondary:[]};
 if(has('plank','crunch','sit-up','sit up','ab','core','carry'))return {primary:['Core'],secondary:[]};
 if(has('hip thrust','glute','bridge'))return {primary:['Glutes'],secondary:['Hamstrings']};
 return {primary:[],secondary:[]};
}

export function muscleRecovery(data:Data):MuscleRecovery[]{
 const now=fitnessNow().getTime();
 return muscleGroups.map(group=>{
  let latestDirect=0,directSets=0,secondarySets=0,stress=0,everDirect=false;
  for(const workout of data.workouts.filter(w=>w.completed)){
   const time=new Date(workout.date).getTime();if(!Number.isFinite(time)||time>now)continue;
   for(const entry of workout.entries){const exercise=data.exercises.find(e=>e.id===entry.exerciseId);if(!exercise)continue;const muscles=exerciseMuscles(exercise),direct=muscles.primary.includes(group),secondary=muscles.secondary.includes(group);if(!direct&&!secondary)continue;
    const attempted=entry.sets.filter(s=>s.status==='completed'||s.status==='modified'||s.status==='failed');if(!attempted.length)continue;if(direct){everDirect=true;latestDirect=Math.max(latestDirect,time)}
    const recentHours=(now-time)/36e5;if(recentHours>120)continue;
    const hard=workout.difficulty==='Very Hard'||workout.difficulty==='Failed'?1.3:workout.difficulty==='Hard'?1.15:workout.difficulty==='Easy'?0.85:1;
    const setStress=attempted.reduce((sum,set)=>sum+(set.status==='failed'?1.25:set.status==='modified'?1.1:1),0)*hard;
    if(direct){directSets+=attempted.length;stress+=setStress}else{secondarySets+=attempted.length}
   }
  }
  if(!everDirect)return {group,state:'Unknown',lastTrained:null,hoursSince:null,directSets:0,secondarySets,detail:secondarySets?'Only secondary involvement is recorded; recovery is not estimated without direct working sets.':'No direct completed sets for this muscle group yet.'};
  const hoursSince=Math.max(0,(now-latestDirect)/36e5),window=Math.min(96,Math.max(36,30+stress*2.25));
  const state:RecoveryState=hoursSince>=window?'Likely ready':hoursSince>=window*.72?'Nearly recovered':'Recovering';
  const parts=directSets?`${directSets} direct ${directSets===1?'set':'sets'}`:'';
  return {group,state,lastTrained:new Date(latestDirect).toISOString(),hoursSince,directSets,secondarySets,detail:`Last trained ${Math.round(hoursSince)} hours ago${parts?` · ${parts} in the recent recovery window`:''}.`};
 });
}
