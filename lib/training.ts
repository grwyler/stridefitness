import {exerciseLibrary} from './exercise-library';
import type {Goal,StrengthProfile} from './goals';
import type {BodyCheckIn} from './body-measurements';
import type {Nutrition} from './nutrition';
import type {DayCompletion} from './day-completion';
import type {DayTracking} from './day-tracking';
export type SetRole='unclassified'|'warmup'|'ramp'|'working'|'top'|'backoff'|'amrap'|'technique'|'drop';
export type ProgressionPolicy={kind:'fixed'|'rep_range';scope?:'group'|'independent';advanceBy?:'auto'|'load'|'reps'|'sets';successSessions?:number;failureAction?:'hold'|'reduce_load'|'reduce_volume'};
export type SetPrescription={id?:string;role:SetRole;countsTowardProgression:boolean;targetWeight:number;minReps:number;maxReps:number;targetRir?:number;targetRpe?:number;group?:string};
export type SetLog={id:string;weight:number;reps:number;targetWeight:number;targetReps:number;status:'pending'|'completed'|'failed'|'skipped'|'modified';difficulty:string;notes:string;prescription?:SetPrescription;actualRir?:number;actualRpe?:number};
export type Exercise={id:string;name:string;category:string;increment:number;mode:'weight'|'reps'|'volume';baseWeight:number;baseReps:number;baseSets:number};
export type Entry={exerciseId:string;sets:SetLog[];progressionPolicy?:ProgressionPolicy;prescriptionVersion?:number;prescriptionContext?:string};
export type Workout={id:string;name:string;templateId?:string;date:string;entries:Entry[];completed:boolean;difficulty:string;notes:string;durationMinutes?:number;caloriesBurned?:number;calorieSource?:'estimate'|'manual';energyMet?:number;energyWeightLb?:number;coachMessages?:{role:'user'|'assistant';content:string}[]};
export type Template={id:string;name:string;description:string;revision?:number;entries:{exerciseId:string;weight:number;reps:number;sets:number;repScheme?:number[];setPrescriptions?:SetPrescription[];progressionPolicy?:ProgressionPolicy}[]};
export type Target={weight:number;reps:number;sets:number};
export type Appearance={colorMode:'light'|'dark'|'system';theme:'forest'|'ocean'|'ember'|'violet';density:'comfortable'|'compact';homeTab:'Overview'|'Workouts'|'Progress'|'Logs'|'Library'};
export type Data={coachChats?:Record<string,import('../components/coach-memory').CoachMessage[]>;coachOffers?:Record<string,import('./coaching-updates').CoachingUpdates>;coachPlanner?:{messages:import('./plan').PlanMessage[];plan:import('./plan').GeneratedPlan|null;ids:string[];draft?:boolean};coachConversations?:{id:string;title:string;closedAt:string;messages:import('./plan').PlanMessage[]}[];profile?:import('./profile').CoachingProfile;user:{id:string;name:string};exercises:Exercise[];workouts:Workout[];templates:Template[];overrides:Record<string,Target>;dark:boolean;appearance?:Appearance;catalogVersion?:number;dataVersion?:number;goals?:Goal[];strengthProfile?:StrengthProfile;nutrition?:Nutrition;bodyMeasurements?:BodyCheckIn[];activityEnergy?:import('./activity-energy').ActivityEnergy;dayCompletions?:DayCompletion[];dayTracking?:DayTracking;recoveryOverrides?:{group:string;reportedAt:string}[]};
export const uid=()=>Math.random().toString(36).slice(2,10);
export const setOf=(weight:number,reps:number,prescription?:SetPrescription):SetLog=>({id:uid(),weight,reps,targetWeight:weight,targetReps:reps,status:'pending',difficulty:'Moderate',notes:'',...(prescription?{prescription:{...prescription}}:{})});
export const history=(d:Data,id:string)=>d.workouts.filter(w=>w.completed&&w.entries.some(e=>e.exerciseId===id&&e.sets.some(s=>s.status!=='skipped'))).sort((a,b)=>b.date.localeCompare(a.date));
export {adaptiveTarget as recommend} from './adaptive-coach';
export const volume=(w:Workout)=>w.entries.reduce((n,e)=>n+e.sets.filter(s=>s.status==='completed'||s.status==='modified').reduce((a,s)=>a+s.weight*s.reps,0),0);
export function initialData():Data{
 return {user:{id:'local-user',name:'You'},exercises:exerciseLibrary.map(e=>({...e})),workouts:[],templates:[],overrides:{},dark:false,catalogVersion:2,dataVersion:1};
}

// One-time migration of the original demo, preserving user-created records and settings.
export function migrateData(data:Data):Data{
 let next=data;
 if((data.catalogVersion||0)<2){
  const originalWeights=[135,185,225,75,115,0,25,30,230];
  const exercises=data.exercises.map(e=>{const index=/^e[0-8]$/.test(e.id)?Number(e.id.slice(1)):-1;const original=exerciseLibrary.find(x=>x.id===e.id);return index>=0&&e.name===original?.name&&e.baseWeight===originalWeights[index]?{...e,baseWeight:0}:e;});
  const ids=new Set(exercises.map(e=>e.id)),names=new Set(exercises.map(e=>e.name.toLowerCase()));
  next={...data,catalogVersion:2,exercises:[...exercises,...exerciseLibrary.filter(e=>!ids.has(e.id)&&!names.has(e.name.toLowerCase())).map(e=>({...e}))],workouts:data.workouts.filter(w=>!/^w(?:[0-9]|1[01])$/.test(w.id)),templates:data.templates.filter(t=>!/^t[123]$/.test(t.id))};
 }
 return (next.dataVersion||0)<1?{...next,dataVersion:1}:next;
}
