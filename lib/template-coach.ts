import {Data,Template} from './training';
import {GeneratedPlan,applyPlan} from './plan';
export function applyTemplateEdit(data:Data,before:Template,plan:GeneratedPlan):Data{
 const current=data.templates.find(t=>t.id===before.id);
 if(!current||JSON.stringify(current)!==JSON.stringify(before))throw new Error('This template changed since your request. Ask your coach again using the latest version.');
 if(plan.workouts.length!==1)throw new Error('Choose one template to adjust at a time.');
 const normalized={...plan,workouts:plan.workouts.map(w=>({...w,entries:w.entries.map(e=>({...e,weight:e.weight??before.entries.find(old=>old.exerciseId===e.exerciseId)?.weight??null}))}))};
 const generated=applyPlan(data,normalized).data.templates.at(-1)!;
 return {...data,templates:data.templates.map(t=>t.id===before.id?{...generated,id:before.id}:t)};
}
