export type FoodLog={id:string;date:string;name:string;calories:number|null;protein:number|null};
export type ActivityCalorieAdjustment=0|50|100;
export type Nutrition={entries:FoodLog[];calorieTarget:number|null;proteinTarget:number|null;activityCalorieAdjustment?:ActivityCalorieAdjustment};
export const emptyNutrition=():Nutrition=>({entries:[],calorieTarget:null,proteinTarget:null,activityCalorieAdjustment:0});
export function calorieBudget(nutrition:Nutrition,activeCalories:number){
 const percent=nutrition.activityCalorieAdjustment===50||nutrition.activityCalorieAdjustment===100?nutrition.activityCalorieAdjustment:0;
 const adjustment=Math.round(Math.max(0,activeCalories)*percent/100);
 return {percent,adjustment,budget:nutrition.calorieTarget===null?null:nutrition.calorieTarget+adjustment};
}
export function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function nutritionTotals(entries:FoodLog[],date:string){const rows=entries.filter(e=>e.date===date);return {count:rows.length,calories:rows.reduce((n,e)=>n+(e.calories??0),0),protein:Math.round(rows.reduce((n,e)=>n+(e.protein??0),0)*10)/10,missingCalories:rows.some(e=>e.calories===null),missingProtein:rows.some(e=>e.protein===null)}}
export function recentFoods(entries:FoodLog[],limit=6){
 const seen=new Set<string>();
 return [...entries].reverse().filter(entry=>{
  const name=entry.name.trim(),normalized=name.toLocaleLowerCase();
  if(!name||normalized==='daily total'||normalized.startsWith('daily total ·'))return false;
  const key=`${normalized}|${entry.calories??''}|${entry.protein??''}`;
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 }).slice(0,limit);
}
