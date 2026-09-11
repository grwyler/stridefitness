export type FoodLog={id:string;date:string;name:string;calories:number|null;protein:number|null};
export type Nutrition={entries:FoodLog[];calorieTarget:number|null;proteinTarget:number|null};
export const emptyNutrition=():Nutrition=>({entries:[],calorieTarget:null,proteinTarget:null});
export function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function nutritionTotals(entries:FoodLog[],date:string){const rows=entries.filter(e=>e.date===date);return {count:rows.length,calories:rows.reduce((n,e)=>n+(e.calories??0),0),protein:Math.round(rows.reduce((n,e)=>n+(e.protein??0),0)*10)/10,missingCalories:rows.some(e=>e.calories===null),missingProtein:rows.some(e=>e.protein===null)}}
