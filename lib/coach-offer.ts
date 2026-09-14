import {coachingUpdatesSchema,type CoachingUpdates} from './coaching-updates';
import {profileSchema} from './profile';
import {applyProgressProposal} from './plan';
import {uid,type Data} from './training';
import {localDay} from './nutrition';
import {validMeasurement} from './body-measurements';
export function applyOffer(data:Data,raw:CoachingUpdates):Data{
 const offer=coachingUpdatesSchema.parse(raw);if(!offer)return data;
 let next=applyProgressProposal(data,{goal:offer.goal,nutrition:offer.nutrition,activityTemplates:[]});
 if(offer.profile.length){const patch=Object.fromEntries(offer.profile.filter(x=>x.value.trim()).map(x=>[x.field,['days','minutes'].includes(x.field)?Number(x.value):x.value]));next={...next,profile:profileSchema.parse({...data.profile,...patch})}}
 if(offer.measurement){const m=offer.measurement,date=m.date||localDay();if(!validMeasurement(date,m.weight,m.bodyFat,localDay()))throw new Error('Please confirm a valid measurement and date.');const rows=next.bodyMeasurements||[],previous=rows.find(x=>x.date===date),entry={id:previous?.id||uid(),date,weight:m.weight??previous?.weight??null,bodyFat:m.bodyFat??previous?.bodyFat??null};next={...next,bodyMeasurements:previous?rows.map(x=>x.id===previous.id?entry:x):[...rows,entry],...(m.weight?{strengthProfile:{bodyweight:m.weight,comparison:next.strengthProfile?.comparison||'general'}}:{})}}
 return next;
}
