import type {BodyCheckIn} from './body-measurements';
import type {Workout} from './training';

export type WorkoutIntensity='Light'|'Moderate'|'Vigorous';
export const intensityMet:Record<WorkoutIntensity,number>={Light:3.5,Moderate:5,Vigorous:6};

export function estimateWorkoutCalories(weightLb:number,durationMinutes:number,intensity:WorkoutIntensity){
 if(!Number.isFinite(weightLb)||weightLb<=0||!Number.isFinite(durationMinutes)||durationMinutes<=0)return 0;
 const kilograms=weightLb/2.2046226218;
 const calories=intensityMet[intensity]*3.5*kilograms/200*durationMinutes;
 return Math.max(5,Math.round(calories/5)*5);
}

export function latestWeight(entries:BodyCheckIn[]|undefined,workoutDate:string){
 const day=workoutDate.slice(0,10);
 return [...(entries||[])].filter(e=>e.date<=day&&e.weight!==null).sort((a,b)=>b.date.localeCompare(a.date))[0]?.weight??null;
}

export function workoutCaloriesForDay(workouts:Workout[]|undefined,day:string){
 return (workouts||[]).filter(w=>w.completed&&w.date.slice(0,10)===day).reduce((sum,w)=>sum+(w.caloriesBurned||0),0);
}

export function intensityFromDifficulty(difficulty:string):WorkoutIntensity{
 if(difficulty==='Easy')return 'Light';
 if(['Hard','Very Hard','Failed'].includes(difficulty))return 'Vigorous';
 return 'Moderate';
}
