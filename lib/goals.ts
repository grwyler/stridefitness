import type {Data} from './training';
export type Goal={id:string;title:string;kind:'measurement'|'sessions'|'strength'|'milestone';unit:string;start:number;target:number;started:string;deadline:string;archived:boolean;exerciseId?:string;checks:{id:string;date:string;value:number;note:string}[]};
export function estimatedStrength(data:Data,exerciseId?:string,after?:string){
 if(!exerciseId)return 0;
 const estimates=data.workouts.filter(w=>w.completed&&(!after||w.date.slice(0,10)>=after)).flatMap(w=>w.entries.filter(e=>e.exerciseId===exerciseId).flatMap(e=>e.sets.filter(s=>s.status==='completed'||s.status==='modified').map(s=>s.weight*(1+s.reps/30))));
 return Math.round(Math.max(0,...estimates));
}
export function goalProgress(goal:Goal,data:Data){
 const checks=[...goal.checks].sort((a,b)=>a.date.localeCompare(b.date));
 const current=goal.kind==='sessions'?data.workouts.filter(w=>w.completed&&w.date.slice(0,10)>=goal.started&&(!goal.deadline||w.date.slice(0,10)<=goal.deadline)).length:goal.kind==='strength'?Math.max(goal.start,estimatedStrength(data,goal.exerciseId,goal.started)):checks.at(-1)?.value??goal.start;
 const distance=goal.target-goal.start,ratio=distance===0?1:(current-goal.start)/distance;
 return {current,percent:Math.max(0,Math.min(100,Math.round(ratio*100))),reached:ratio>=1,checks};
}
