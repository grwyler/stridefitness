import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isSiteOwner} from '@/lib/ai-connection';
import {adminDatabase} from '@/lib/admin-activity';
import {estimateWorkoutCalories,intensityFromDifficulty,intensityMet,latestWeight} from '@/lib/workout-energy';

const input=z.object({userId:z.string().regex(/^[a-f0-9]{64}(?::test)?$/),workoutIds:z.array(z.string().min(1).max(100)).min(1).max(20)});
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 const owner=await getChatGPTUser(request);if(!owner||!await isSiteOwner(owner))return json({error:'Owner access is required.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Open this action from Stride.'},403);
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({error:'Invalid workout selection.'},400);
 try{
  const db=adminDatabase(),row=await db.prepare('SELECT data,updated_at FROM user_training_data WHERE user_id=?').bind(parsed.data.userId).first<{data:string;updated_at:string}>();
  if(!row)return json({error:'This account no longer has saved training data.'},404);
  const data=JSON.parse(row.data) as any,requested=new Set(parsed.data.workoutIds),workouts=Array.isArray(data.workouts)?data.workouts:[];
  const targets=workouts.filter((workout:any)=>requested.has(workout.id)&&workout.completed&&workout.caloriesBurned===undefined);
  if(targets.length!==requested.size)return json({error:'One or more selected workouts changed. Refresh the account and try again.'},409);
  const missing=targets.filter((workout:any)=>(workout.energyWeightLb??latestWeight(data.bodyMeasurements,workout.date)??data.strengthProfile?.bodyweight??null)===null);
  if(missing.length)return json({error:`Cannot estimate calories until ${missing.map((workout:any)=>workout.name||'this workout').join(' and ')} has a saved body weight.`},422);
  const next={...data,workouts:workouts.map((workout:any)=>{
   if(!requested.has(workout.id))return workout;
   const weight=workout.energyWeightLb??latestWeight(data.bodyMeasurements,workout.date)??data.strengthProfile?.bodyweight;
   const duration=workout.durationMinutes??60,intensity=workout.energyMet===intensityMet.Light?'Light':workout.energyMet===intensityMet.Vigorous?'Vigorous':intensityFromDifficulty(workout.difficulty);
   return {...workout,durationMinutes:duration,caloriesBurned:estimateWorkoutCalories(weight,duration,intensity),calorieSource:'estimate',energyMet:intensityMet[intensity],energyWeightLb:weight};
  })};
  const now=new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString(),saved=await db.prepare('UPDATE user_training_data SET data=?,updated_at=? WHERE user_id=? AND updated_at=?').bind(JSON.stringify(next),now,parsed.data.userId,row.updated_at).run();
  if(!saved.meta.changes)return json({error:'The account changed. Refresh and try again.'},409);
  return json({saved:true,count:targets.length});
 }catch{return json({error:'Workout calories could not be saved. Please try again.'},503)}
}
