import type {Data,Workout} from './training';

export type ActivityIntensity='Light'|'Moderate'|'Vigorous';
export type ActivityTemplate={id:string;name:string;description:string;durationMinutes:number;intensity:ActivityIntensity;met:number;scheduleHint:string};
export type ActivityLog={id:string;templateId?:string;name:string;date:string;durationMinutes:number;intensity:ActivityIntensity;met:number;caloriesBurned:number;calorieSource:'estimate'|'manual'|'integration';energyWeightLb:number|null;notes:string};
export type ActivityEnergy={templates:ActivityTemplate[];logs:ActivityLog[]};
export type ActivityTemplateProposal=Omit<ActivityTemplate,'id'>;

export const emptyActivityEnergy=():ActivityEnergy=>({templates:[],logs:[]});

export function estimateActivityCalories(weightLb:number,durationMinutes:number,met:number){
 if(!Number.isFinite(weightLb)||weightLb<=0||!Number.isFinite(durationMinutes)||durationMinutes<=0||!Number.isFinite(met)||met<=0)return 0;
 const calories=met*3.5*(weightLb/2.2046226218)/200*durationMinutes;
 return Math.max(5,Math.round(calories/5)*5);
}

export function activityCaloriesForDay(logs:ActivityLog[]|undefined,day:string){
 return (logs||[]).filter(log=>log.date===day).reduce((sum,log)=>sum+(log.caloriesBurned||0),0);
}

export function strengthCaloriesForDay(workouts:Workout[]|undefined,day:string){
 return (workouts||[]).filter(w=>w.completed&&w.date.slice(0,10)===day).reduce((sum,w)=>sum+(w.caloriesBurned||0),0);
}

export function activeCaloriesForDay(data:Pick<Data,'workouts'|'activityEnergy'>,day:string){
 const strength=strengthCaloriesForDay(data.workouts,day),other=activityCaloriesForDay(data.activityEnergy?.logs,day);
 return {strength,other,total:strength+other};
}

export function bestKnownWeight(data:Pick<Data,'bodyMeasurements'|'workouts'|'activityEnergy'>,day:string){
 const candidates=[
  ...(data.bodyMeasurements||[]).filter(x=>x.date<=day&&x.weight!==null).map(x=>({date:x.date,value:x.weight!})),
  ...(data.workouts||[]).filter(x=>x.date.slice(0,10)<=day&&x.energyWeightLb).map(x=>({date:x.date.slice(0,10),value:x.energyWeightLb!})),
  ...(data.activityEnergy?.logs||[]).filter(x=>x.date<=day&&x.energyWeightLb).map(x=>({date:x.date,value:x.energyWeightLb!}))
 ];
 return candidates.sort((a,b)=>b.date.localeCompare(a.date))[0]?.value??null;
}
