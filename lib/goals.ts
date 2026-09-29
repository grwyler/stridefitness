import type {Data} from './training';
import {fitnessNow} from './fitness-clock';
import {isDayComplete} from './day-completion';
export const compoundLifts=[{id:'e1',name:'Back squat',ratio:1.5},{id:'e0',name:'Bench press',ratio:1},{id:'e2',name:'Deadlift',ratio:1.75},{id:'e3',name:'Overhead press',ratio:.65},{id:'e4',name:'Barbell row',ratio:.9}];
export type StrengthProfile={bodyweight:number|null;comparison:'general'|'men'|'women';heightInches?:number|null;recoveryFigure?:'masculine'|'neutral'|'feminine'};
export function benchmarkComparison(sex:'Male'|'Female'|null|undefined,legacy:StrengthProfile['comparison']='general'):StrengthProfile['comparison']{
 return sex==='Male'?'men':sex==='Female'?'women':legacy;
}
export type DailyGoalMetric='hydration'|'activeCalories'|'protein'|'calorieIntake';
export type Goal={id:string;title:string;kind:'measurement'|'daily'|'sessions'|'strength'|'compound'|'milestone';unit:string;start:number;target:number;started:string;deadline:string;archived:boolean;exerciseId?:string;measurementMetric?:'weight'|'bodyFat';dailyMetric?:DailyGoalMetric;checks:{id:string;date:string;value:number;note:string}[]};
export function estimatedOneRepMax(weight:number,reps:number){
 if(weight<=0||reps<=0)return 0;
 return Math.round(weight*(1+reps/30));
}
export function estimatedStrength(data:Data,exerciseId?:string,after?:string){
 if(!exerciseId)return 0;
 const estimates=data.workouts.filter(w=>w.completed&&(!after||w.date.slice(0,10)>=after)).flatMap(w=>w.entries.filter(e=>e.exerciseId===exerciseId).flatMap(e=>e.sets.filter(s=>s.status==='completed'||s.status==='modified').map(s=>estimatedOneRepMax(s.weight,s.reps))));
 return Math.max(0,...estimates);
}
export function compoundTotal(data:Data,after?:string){return compoundLifts.reduce((sum,lift)=>sum+estimatedStrength(data,lift.id,after),0)}
export function strengthBalance(data:Data){
 const lifts=compoundLifts.map(lift=>({...lift,value:estimatedStrength(data,lift.id)})),observed=lifts.filter(l=>l.value>0),scale=observed.length?observed.reduce((n,l)=>n+l.value/l.ratio,0)/observed.length:0;
 return lifts.map(lift=>({...lift,expected:Math.round(scale*lift.ratio),balance:lift.value&&scale?Math.round(lift.value/(scale*lift.ratio)*100):null}));
}
export type StrengthRankingGroup='population'|'sex'|'age'|'height';
// Broad reference tiers normalized to body weight when known. This is an indicative score, not a measured population percentile.
const rankTiers=[0,0.25,0.5,0.75,1,1.25,1.5,1.8,2.1,2.5,3,3.6,4.3,5.1,6];
export function strengthRanking(data:Data,group:StrengthRankingGroup='population'){
 const lifts=strengthBalance(data),count=lifts.filter(lift=>lift.value>0).length;
 if(count<5)return {score:0,count,group};
 const bodyweight=data.strengthProfile?.bodyweight??[...(data.bodyMeasurements||[])].filter(x=>x.weight!==null).sort((a,b)=>b.date.localeCompare(a.date))[0]?.weight??null;
 const profile=data.profile,genderFactor=profile?.sex==='Female'?0.72:profile?.sex==='Male'?1:null,ageFactor=profile?.ageRange==='60+'?0.8:profile?.ageRange==='45–59'?0.9:profile?.ageRange==='Under 18'?0.75:profile?.ageRange?1:null,height=data.strengthProfile?.heightInches??null;
 const factor=group==='population'?.86:group==='sex'?(genderFactor??.86):group==='age'?(ageFactor??.86):group==='height'?(height?Math.max(.8,Math.min(1.2,70/height)):.86):.86;
 const mass=bodyweight??154.3,normalized=lifts.reduce((sum,lift)=>sum+lift.value/lift.ratio,0)/5/mass/factor;
 let band=rankTiers.findIndex(value=>normalized<value);if(band<0)band=rankTiers.length;
 const lower=Math.max(0,Math.min(rankTiers.length-2,band-1)),low=rankTiers[lower],high=rankTiers[lower+1],fraction=Math.max(0,Math.min(1,(normalized-low)/(high-low)));
 return {score:Math.max(1,Math.min(100,Math.round((lower+fraction)/(rankTiers.length-2)*100))),count,group};
}
export function goalMeasurementMetric(goal:Goal):'weight'|'bodyFat'|null{
 if(goal.kind!=='measurement')return null;
 if(goal.measurementMetric)return goal.measurementMetric;
 const description=`${goal.title} ${goal.unit}`.toLowerCase();
 if(/body\s*fat|fat\s*percentage|bodyfat/.test(description))return 'bodyFat';
 if(/body\s*weight|weight|\b(lb|lbs|pound|pounds)\b/.test(description))return 'weight';
 return null;
}
const dateAt=(day:string,offset:number)=>new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
export function dailyGoalValue(goal:Goal,data:Data,day:string){
 if(goal.dailyMetric==='hydration')return (data.nutrition?.hydration?.entries||[]).filter(entry=>entry.date===day).reduce((sum,entry)=>sum+entry.ounces,0);
 if(goal.dailyMetric==='activeCalories')return data.workouts.filter(workout=>workout.completed&&workout.date.slice(0,10)===day).reduce((sum,workout)=>sum+(workout.caloriesBurned||0),0)+(data.activityEnergy?.logs||[]).filter(log=>log.date===day).reduce((sum,log)=>sum+(log.caloriesBurned||0),0);
 const food=(data.nutrition?.entries||[]).filter(entry=>entry.date===day);
 return goal.dailyMetric==='protein'?Math.round(food.reduce((sum,entry)=>sum+(entry.protein||0),0)*10)/10:goal.dailyMetric==='calorieIntake'?food.reduce((sum,entry)=>sum+(entry.calories||0),0):0;
}
export function dailyGoalHistory(goal:Goal,data:Data,end:string,days=7){
 return Array.from({length:days},(_,index)=>{const date=dateAt(end,index-days+1),value=dailyGoalValue(goal,data,date),complete=isDayComplete(data.dayCompletions,date);return {date,value,complete,met:complete&&value>=goal.target,logged:value>0}}).filter(row=>row.date>=goal.started&&(!goal.deadline||row.date<=goal.deadline));
}
export function goalProgress(goal:Goal,data:Data,asOf=fitnessNow().toLocaleDateString('en-CA')){
 const checks=[...goal.checks].sort((a,b)=>a.date.localeCompare(b.date));
 const measurement=goalMeasurementMetric(goal);
 const linked=measurement?[...(data.bodyMeasurements||[])].filter(entry=>entry.date>=goal.started&&entry[measurement]!==null).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)?.[measurement]??null:null;
 const current=goal.kind==='daily'?dailyGoalValue(goal,data,asOf):goal.kind==='sessions'?data.workouts.filter(w=>w.completed&&w.date.slice(0,10)>=goal.started&&w.date.slice(0,10)<=asOf&&(!goal.deadline||w.date.slice(0,10)<=goal.deadline)).length:goal.kind==='strength'?Math.max(goal.start,estimatedStrength(data,goal.exerciseId,goal.started)):goal.kind==='compound'?Math.max(goal.start,compoundTotal(data,goal.started)):linked??checks.at(-1)?.value??goal.start;
 const distance=goal.target-goal.start,ratio=goal.kind==='daily'?current/goal.target:distance===0?1:(current-goal.start)/distance;
 return {current,percent:Math.max(0,Math.min(100,Math.round(ratio*100))),reached:ratio>=1,checks};
}
