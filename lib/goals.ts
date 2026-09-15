import type {Data} from './training';
export const compoundLifts=[{id:'e1',name:'Back squat',ratio:1.5},{id:'e0',name:'Bench press',ratio:1},{id:'e2',name:'Deadlift',ratio:1.75},{id:'e3',name:'Overhead press',ratio:.65},{id:'e4',name:'Barbell row',ratio:.9}];
export type StrengthProfile={bodyweight:number|null;comparison:'general'|'men'|'women';heightInches?:number|null;recoveryFigure?:'masculine'|'neutral'|'feminine'};
export type Goal={id:string;title:string;kind:'measurement'|'sessions'|'strength'|'compound'|'milestone';unit:string;start:number;target:number;started:string;deadline:string;archived:boolean;exerciseId?:string;checks:{id:string;date:string;value:number;note:string}[]};
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
export function goalProgress(goal:Goal,data:Data){
 const checks=[...goal.checks].sort((a,b)=>a.date.localeCompare(b.date));
 const current=goal.kind==='sessions'?data.workouts.filter(w=>w.completed&&w.date.slice(0,10)>=goal.started&&(!goal.deadline||w.date.slice(0,10)<=goal.deadline)).length:goal.kind==='strength'?Math.max(goal.start,estimatedStrength(data,goal.exerciseId,goal.started)):goal.kind==='compound'?Math.max(goal.start,compoundTotal(data,goal.started)):checks.at(-1)?.value??goal.start;
 const distance=goal.target-goal.start,ratio=distance===0?1:(current-goal.start)/distance;
 return {current,percent:Math.max(0,Math.min(100,Math.round(ratio*100))),reached:ratio>=1,checks};
}
