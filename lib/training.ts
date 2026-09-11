export type SetLog={id:string;weight:number;reps:number;targetWeight:number;targetReps:number;status:'pending'|'completed'|'failed'|'skipped'|'modified';difficulty:string;notes:string};
export type Exercise={id:string;name:string;category:string;increment:number;mode:'weight'|'reps'|'volume';baseWeight:number;baseReps:number;baseSets:number};
export type Entry={exerciseId:string;sets:SetLog[]};
export type Workout={id:string;name:string;date:string;entries:Entry[];completed:boolean;difficulty:string;notes:string};
export type Template={id:string;name:string;description:string;entries:{exerciseId:string;weight:number;reps:number;sets:number}[]};
export type Target={weight:number;reps:number;sets:number};
export type Data={user:{id:string;name:string};exercises:Exercise[];workouts:Workout[];templates:Template[];overrides:Record<string,Target>;dark:boolean};
export const uid=()=>Math.random().toString(36).slice(2,10);
export const setOf=(weight:number,reps:number):SetLog=>({id:uid(),weight,reps,targetWeight:weight,targetReps:reps,status:'pending',difficulty:'Moderate',notes:''});
export const history=(d:Data,id:string)=>d.workouts.filter(w=>w.completed&&w.entries.some(e=>e.exerciseId===id&&e.sets.some(s=>s.status!=='skipped'))).sort((a,b)=>b.date.localeCompare(a.date));
const struggled=(w:Workout,id:string)=>w.difficulty==='Failed'||w.entries.find(e=>e.exerciseId===id)!.sets.some(s=>s.status==='failed'||s.status==='skipped'||s.reps<s.targetReps||s.weight<s.targetWeight||s.difficulty==='Failed');
export function recommend(d:Data,e:Exercise){
 const h=history(d,e.id),w=h[0],sets=w?.entries.find(x=>x.exerciseId===e.id)?.sets||[];
 const last=sets.find(s=>s.status!=='skipped');
 let t:Target={weight:last?.targetWeight??e.baseWeight,reps:last?.targetReps??e.baseReps,sets:sets.length||e.baseSets};
 let kind='Repeat',why='Start here to establish a baseline. Adjust this target to your experience.';
 const round=(n:number)=>Math.max(0,Math.round(n/e.increment)*e.increment);
 if(w){const streak=h.slice(0,3).filter(x=>struggled(x,e.id)).length;const bad=struggled(w,e.id);const stale=(Date.now()-new Date(w.date).getTime())/86400000>21;const hard=w.difficulty==='Very Hard'||sets.some(s=>s.difficulty==='Very Hard');
 if(stale){why='It has been over 3 weeks since this exercise. Ease back in with a lighter target.';kind='Reduce';t.weight=round(t.weight*.9);if(!t.weight)t.reps=Math.max(1,t.reps-1);}
 else if(bad&&streak>=3){kind='Deload';t.weight=round(t.weight*.85);t.sets=Math.max(1,t.sets-1);why='Targets were missed in three recent sessions. Try less weight and one fewer set, then reassess.';}
 else if(bad&&h[1]&&struggled(h[1],e.id)){kind='Reduce';t.weight=round(t.weight*.9);if(!t.weight)t.reps=Math.max(1,t.reps-1);why='You missed targets two sessions in a row. A lighter target gives you room to rebuild.';}
 else if(bad){why='Some targets were missed or skipped last time. Repeat before adding more.';}
 else if(hard){why='You completed the target but marked it very hard. Repeat before increasing.';}
 else if(sets.every(s=>(s.status==='completed'||s.status==='modified')&&s.difficulty!=='Failed')){kind='Increase';why=`You completed ${sets.length} × ${t.reps} at ${t.weight} lb with manageable difficulty. Try a small ${e.mode==='weight'?'weight':e.mode==='reps'?'rep':'volume'} increase.`;if(e.mode==='weight')t.weight+=e.increment;else if(e.mode==='reps')t.reps+=1;else t.sets+=1;}
 }
 return {...t,kind,why,overridden:!!d.overrides[e.id],...(d.overrides[e.id]||{})};
}
export const volume=(w:Workout)=>w.entries.reduce((n,e)=>n+e.sets.filter(s=>s.status==='completed'||s.status==='modified').reduce((a,s)=>a+s.weight*s.reps,0),0);
export function seed():Data{
 const defs=[['Bench press','Chest',135],['Back squat','Legs',185],['Deadlift','Posterior chain',225],['Overhead press','Shoulders',75],['Barbell row','Back',115],['Pull-up','Back',0],['Dumbbell curl','Arms',25],['Triceps extension','Arms',30],['Leg press','Legs',230]] as const;
 const exercises:Exercise[]=defs.map(([name,category,weight],i)=>({id:'e'+i,name,category,increment:5,mode:weight?'weight':'reps',baseWeight:weight,baseReps:8,baseSets:3}));
 const templates:Template[]=[{id:'t1',name:'Upper body',description:'A balanced push and pull session',entries:[0,4,3,6].map(i=>({exerciseId:'e'+i,weight:exercises[i].baseWeight,reps:8,sets:3}))},{id:'t2',name:'Lower body',description:'Build your foundation',entries:[1,2,8].map(i=>({exerciseId:'e'+i,weight:exercises[i].baseWeight,reps:8,sets:3}))},{id:'t3',name:'Full body',description:'A little of everything',entries:[1,0,4].map(i=>({exerciseId:'e'+i,weight:exercises[i].baseWeight,reps:8,sets:3}))}];
 const workouts:Workout[]=[];
 for(let day=0;day<12;day++){let age=2+(11-day)*2;let template=templates[day%2];workouts.push({id:'w'+day,name:template.name,date:new Date(Date.now()-age*86400000).toISOString(),completed:true,difficulty:'Moderate',notes:'',entries:template.entries.map(x=>{let ex=exercises.find(e=>e.id===x.exerciseId)!;let weight=ex.baseWeight-Math.floor((11-day)/3)*5;return {exerciseId:ex.id,sets:Array.from({length:3},(_,i)=>({...setOf(weight,8),status:ex.id==='e1'&&day>=9&&i===2?'failed':'completed',reps:ex.id==='e1'&&day>=9&&i===2?6:8,difficulty:ex.id==='e3'?'Very Hard':'Moderate'} as SetLog))}})});}
 return {user:{id:'local-user',name:'You'},exercises,workouts,templates,overrides:{},dark:false};
}
