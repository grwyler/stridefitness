import {fitnessNow} from '@/lib/fitness-clock';
export type FoodLog={id:string;date:string;name:string;calories:number|null;protein:number|null;carbs?:number|null;fat?:number|null};
export type HydrationLog={id:string;date:string;ounces:number};
export type ActivityCalorieAdjustment=0|50|100;
export type Nutrition={entries:FoodLog[];calorieTarget:number|null;proteinTarget:number|null;carbTarget?:number|null;fatTarget?:number|null;activityCalorieAdjustment?:ActivityCalorieAdjustment;hydration?:{dailyTargetOz:number|null;entries:HydrationLog[]}};
export const emptyNutrition=():Nutrition=>({entries:[],calorieTarget:null,proteinTarget:null,carbTarget:null,fatTarget:null,activityCalorieAdjustment:0,hydration:{dailyTargetOz:null,entries:[]}});
export function calorieBudget(nutrition:Nutrition,activeCalories:number){
 const percent=nutrition.activityCalorieAdjustment===50||nutrition.activityCalorieAdjustment===100?nutrition.activityCalorieAdjustment:0;
 const adjustment=Math.round(Math.max(0,activeCalories)*percent/100);
 return {percent,adjustment,budget:nutrition.calorieTarget===null?null:nutrition.calorieTarget+adjustment};
}
export function localDay(){const d=fitnessNow();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function nutritionTotals(entries:FoodLog[],date:string){const rows=entries.filter(e=>e.date===date),sum=(key:'protein'|'carbs'|'fat')=>Math.round(rows.reduce((n,e)=>n+(e[key]??0),0)*10)/10;return {count:rows.length,calories:rows.reduce((n,e)=>n+(e.calories??0),0),protein:sum('protein'),carbs:sum('carbs'),fat:sum('fat'),missingCalories:rows.some(e=>e.calories===null),missingProtein:rows.some(e=>e.protein===null),missingCarbs:rows.some(e=>e.carbs==null),missingFat:rows.some(e=>e.fat==null)}}
export function hydrationTotal(nutrition:Nutrition|undefined,date:string){return (nutrition?.hydration?.entries||[]).filter(e=>e.date===date).reduce((sum,e)=>sum+e.ounces,0)}
export function recentFoods(entries:FoodLog[],limit=6){
 const seen=new Set<string>();
 return [...entries].reverse().filter(entry=>{
  const name=entry.name.trim(),normalized=name.toLocaleLowerCase();
  if(!name||normalized==='daily total'||normalized.startsWith('daily total ·'))return false;
  const key=`${normalized}|${entry.calories??''}|${entry.protein??''}|${entry.carbs??''}|${entry.fat??''}`;
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 }).slice(0,limit);
}
