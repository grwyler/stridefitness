import type {Data} from './training';
export type Goal={id:string;title:string;kind:'measurement'|'sessions'|'milestone';unit:string;start:number;target:number;started:string;deadline:string;archived:boolean;checks:{id:string;date:string;value:number;note:string}[]};
export function goalProgress(goal:Goal,data:Data){
 const checks=[...goal.checks].sort((a,b)=>a.date.localeCompare(b.date));
 const current=goal.kind==='sessions'?data.workouts.filter(w=>w.completed&&w.date.slice(0,10)>=goal.started&&(!goal.deadline||w.date.slice(0,10)<=goal.deadline)).length:checks.at(-1)?.value??goal.start;
 const distance=goal.target-goal.start,ratio=distance===0?1:(current-goal.start)/distance;
 return {current,percent:Math.max(0,Math.min(100,Math.round(ratio*100))),reached:ratio>=1,checks};
}
