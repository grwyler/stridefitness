import type {Exercise,ExerciseProgrammingProfile,ExerciseMovementClass} from './training';

const defaults:Record<ExerciseMovementClass,Omit<ExerciseProgrammingProfile,'movementClass'>>={
 heavy_technical_compound:{defaultRepMin:4,defaultRepMax:8,progressionBias:'reps',preferredRir:3},
 general_compound:{defaultRepMin:6,defaultRepMax:10,progressionBias:'balanced',preferredRir:2},
 stable_compound:{defaultRepMin:8,defaultRepMax:12,progressionBias:'balanced',preferredRir:2},
 isolation:{defaultRepMin:10,defaultRepMax:15,progressionBias:'reps',preferredRir:2},
 small_muscle_isolation:{defaultRepMin:12,defaultRepMax:20,progressionBias:'reps',preferredRir:2},
};

export function resolveExerciseProgrammingProfile(exercise:Pick<Exercise,'name'|'category'|'mode'|'programmingProfile'>):ExerciseProgrammingProfile{
 if(exercise.programmingProfile)return {...exercise.programmingProfile};
 const name=exercise.name.toLowerCase(),category=exercise.category.toLowerCase();
 let movementClass:ExerciseMovementClass;
 if(/deadlift|good morning|barbell squat|front squat|clean|snatch|turkish get-up/.test(name))movementClass='heavy_technical_compound';
 else if(/lateral raise|rear-delt|wrist|calf|rotator|finger|neck/.test(name))movementClass='small_muscle_isolation';
 else if(/machine|chest-supported|supported row/.test(name))movementClass=exercise.mode==='weight'?'stable_compound':'isolation';
 else if(/curl|extension|fly|raise|pushdown|kickback|pullover/.test(name)||['arms','shoulders','calves'].includes(category))movementClass='isolation';
 else if(['chest','back','legs','full body'].includes(category))movementClass='general_compound';
 else movementClass=exercise.mode==='reps'?'small_muscle_isolation':'general_compound';
 return {movementClass,...defaults[movementClass]};
}

export function defaultRepRange(exercise:Pick<Exercise,'name'|'category'|'mode'|'programmingProfile'>,override?:{min:number;max:number}){
 if(override&&Number.isInteger(override.min)&&Number.isInteger(override.max)&&override.min>=1&&override.max>=override.min)return {min:override.min,max:override.max};
 const profile=resolveExerciseProgrammingProfile(exercise);
 return {min:profile.defaultRepMin,max:profile.defaultRepMax};
}
