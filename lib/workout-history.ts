import type {Entry,SetLog,SetScheme} from './training';
export const schemeLabel:Record<SetScheme,string>={straight:'Straight sets',ascending_pyramid:'Ascending pyramid',reverse_pyramid:'Reverse pyramid',amrap:'AMRAP',drop_multi_tier:'Drop / multi-tier'};
export function formatSchemeHistory(entry:Entry):string{
 const original=entry.originalSetScheme,changes=entry.sessionSchemeChanges||[];
 return original&&changes.length?`${schemeLabel[original]} → ${schemeLabel[entry.setScheme||'straight']} (session-only scheme change)`:schemeLabel[entry.setScheme||'straight'];
}
export function formatSetHistory(set:SetLog):string{
 if(set.prescription?.tiers?.length){
  return set.prescription.tiers.map(target=>{
   const adapted=set.sessionPrescription?.tiers?.find(tier=>tier.order===target.order),actual=set.tierActuals?.find(tier=>tier.order===target.order),currentWeight=adapted?.targetWeight??target.targetWeight,currentMin=adapted?.minReps??target.minReps,currentMax=adapted?.maxReps??target.maxReps;
   const range=target.minReps===target.maxReps?`${target.minReps}`:`${target.minReps}–${target.maxReps}`;
   const adjusted=adapted&&(adapted.targetWeight!==target.targetWeight||adapted.minReps!==target.minReps||adapted.maxReps!==target.maxReps)?` → adapted ${currentWeight}×${currentMin}–${currentMax}`:'';
   const performed=actual?.actualWeight!==undefined&&actual.actualReps!==undefined?`${actual.actualWeight}×${actual.actualReps}`:'not performed';
   return `Tier ${target.order}: target ${target.targetWeight}×${range}${adjusted}; actual ${performed} (${actual?.status||'pending'})`;
  }).join(' · ');
 }
 return `${set.weight} × ${set.reps} (target ${set.targetWeight} × ${set.prescription?`${set.prescription.minReps}${set.prescription.maxReps!==set.prescription.minReps?`–${set.prescription.maxReps}`:''}`:set.targetReps}${set.prescription&&set.prescription.role!=='unclassified'?`, ${set.prescription.role}`:''})${set.status==='failed'?' (failed)':set.status==='modified'?' (modified)':set.status==='skipped'?' (skipped)':''}`;
}
