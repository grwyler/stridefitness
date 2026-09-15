import {fitnessNow} from './fitness-clock';
import type {Data,Exercise} from './training';

export const muscleGroups=['Upper Chest','Mid Chest','Lower Chest','Front Delts','Side Delts','Rear Delts','Traps','Triceps','Forearms','Upper Back','Lower Back','Biceps','Core','Glutes','Quadriceps','Hamstrings','Calves'] as const;
export type MuscleGroup=typeof muscleGroups[number];
export type RecoveryState='Recovering'|'Nearly recovered'|'Likely ready'|'Unknown';
export type MuscleRecovery={group:MuscleGroup;state:RecoveryState;lastTrained:string|null;hoursSince:number|null;directSets:number;secondarySets:number;detail:string};

const categoryGroups:Record<string,MuscleGroup[]>={chest:['Mid Chest'],shoulders:['Front Delts','Side Delts'],back:['Upper Back'],arms:['Biceps','Triceps'],core:['Core'],legs:['Quadriceps'],glutes:['Glutes'],hamstrings:['Hamstrings'],quadriceps:['Quadriceps'],calves:['Calves'],traps:['Traps'],forearms:['Forearms'],biceps:['Biceps'],triceps:['Triceps']};
const result=(primary:MuscleGroup[],secondary:MuscleGroup[]=[])=>({primary,secondary:secondary.filter(group=>!primary.includes(group))});

export function exerciseMuscles(exercise:Pick<Exercise,'name'|'category'>):{primary:MuscleGroup[];secondary:MuscleGroup[]}{
 const name=exercise.name.toLowerCase(),category=exercise.category.trim().toLowerCase(),has=(...words:string[])=>words.some(word=>name.includes(word));
 const exact=muscleGroups.find(group=>category===group.toLowerCase());
 if(name.endsWith(' isolation test')&&exact)return result([exact]);
 if(has('rear delt','reverse fly','reverse pec','face pull','band pull-apart','band pull apart'))return result(['Rear Delts'],['Upper Back','Traps']);
 if((has('incline')&&has('press','bench','fly','push-up','push up'))||has('low-to-high'))return result(['Upper Chest'],['Front Delts','Triceps']);
 if((has('decline')&&has('press','bench','fly','push-up','push up'))||has('high-to-low','chest dip'))return result(['Lower Chest'],['Triceps','Front Delts']);
 if(has('close-grip bench','close grip bench','tricep','skull crusher','pushdown','jm press'))return result(['Triceps'],['Front Delts','Mid Chest']);
 if(has('bench','floor press','chest press','push-up','push up','fly','pec deck','pec fly','chest'))return result(['Mid Chest'],['Triceps','Front Delts']);
 if(has('lateral raise','upright row'))return result(['Side Delts'],['Traps']);
 if(has('front raise','landmine press'))return result(['Front Delts'],['Upper Chest','Triceps']);
 if(has('overhead press','shoulder press','arnold press','military press','push press'))return result(['Front Delts','Side Delts'],['Triceps','Traps']);
 if(has('shrug'))return result(['Traps'],['Forearms']);
 if(has('wrist curl','wrist extension','forearm','farmer','grip','dead hang'))return result(['Forearms'],['Traps']);
 if(has('reverse curl'))return result(['Biceps','Forearms']);
 if(has('curl','bicep','chin-up','chin up'))return result(['Biceps'],has('chin-up','chin up')?['Upper Back','Forearms']:['Forearms']);
 if(has('deadlift','good morning','back extension','hyperextension'))return result(['Lower Back','Hamstrings','Glutes'],['Core','Traps','Forearms']);
 if(has('pendlay row','barbell row','t-bar row','t bar row','cable row','machine row','dumbbell row','inverted row','ring row','seal row','meadows row','row'))return result(['Upper Back'],['Biceps','Rear Delts','Forearms']);
 if(has('pull-up','pull up','pulldown','pull-down','lat prayer','lat'))return result(['Upper Back'],['Biceps','Forearms']);
 if(has('squat','leg press','lunge','split squat','step-up','step up','hack squat'))return result(['Quadriceps','Glutes'],['Hamstrings','Core','Lower Back']);
 if(has('hamstring','leg curl','romanian','stiff-leg','stiff leg'))return result(['Hamstrings','Glutes'],['Lower Back']);
 if(has('calf'))return result(['Calves']);
 if(has('plank','crunch','sit-up','sit up','ab wheel','ab','core','carry'))return result(['Core']);
 if(has('hip thrust','glute','bridge'))return result(['Glutes'],['Hamstrings']);
 if(exact)return result([exact]);
 return result(categoryGroups[category]||[]);
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
