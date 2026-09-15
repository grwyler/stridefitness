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
 if(offer.measurement){const m=offer.measurement,date=m.date||localDay();if((m.weight!==null||m.bodyFat!==null)&&!validMeasurement(date,m.weight,m.bodyFat,localDay()))throw new Error('Please confirm a valid measurement and date.');const rows=next.bodyMeasurements||[],previous=rows.find(x=>x.date===date),entry={id:previous?.id||uid(),date,weight:m.weight??previous?.weight??null,bodyFat:m.bodyFat??previous?.bodyFat??null};next={...next,...(m.weight!==null||m.bodyFat!==null?{bodyMeasurements:previous?rows.map(x=>x.id===previous.id?entry:x):[...rows,entry]}:{}),strengthProfile:{bodyweight:m.weight??next.strengthProfile?.bodyweight??null,comparison:next.strengthProfile?.comparison||'general',heightInches:m.heightInches??next.strengthProfile?.heightInches??null,...(next.strengthProfile?.recoveryFigure?{recoveryFigure:next.strengthProfile.recoveryFigure}:{})}}}
 return next;
}

export function offerOverwrites(data:Data,raw:CoachingUpdates){
 const offer=coachingUpdatesSchema.parse(raw);if(!offer)return false;
 if(offer.profile.some(update=>{const old=data.profile?.[update.field];return old!==null&&old!==undefined&&String(old)!==update.value}))return true;
 const nutrition=offer.nutrition;if(nutrition&&(['calorieTarget','proteinTarget','activityCalorieAdjustment'] as const).some(field=>nutrition[field]!==null&&data.nutrition?.[field]!=null&&nutrition[field]!==data.nutrition[field]))return true;
 if(offer.measurement){const today=offer.measurement.date||localDay(),row=(data.bodyMeasurements||[]).find(item=>item.date===today),m=offer.measurement;if((m.weight!==null&&row?.weight!=null&&m.weight!==row.weight)||(m.bodyFat!==null&&row?.bodyFat!=null&&m.bodyFat!==row.bodyFat)||(m.heightInches!==null&&data.strengthProfile?.heightInches!=null&&m.heightInches!==data.strengthProfile.heightInches))return true}
 return false;
}
