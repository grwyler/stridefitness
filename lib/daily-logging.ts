import type {Workout} from './training';
import type {ActivityLog} from './activity-energy';
export function onLocalDay(workout:Workout,now=new Date()){
 const day=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 return workout.date.includes('T')?day(new Date(workout.date))===day(now):workout.date===day(now);
}
export function recentActivities(logs:ActivityLog[],limit=5){
 const seen=new Set<string>();return [...logs].reverse().sort((a,b)=>b.date.localeCompare(a.date)).filter(x=>{const key=x.name.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true}).slice(0,limit);
}
