import type {Template,Workout} from './training';

/** Follow the saved template order after the latest completed plan workout. */
export function nextTemplate(templates:Template[],completed:Workout[]){
 if(!templates.length)return undefined;
 const latest=[...completed].sort((a,b)=>b.date.localeCompare(a.date)).find(workout=>templates.some(template=>workout.templateId===template.id||workout.name===template.name));
 if(!latest)return templates[0];
 const index=templates.findIndex(template=>latest.templateId===template.id||latest.name===template.name);
 return templates[(index+1)%templates.length];
}
